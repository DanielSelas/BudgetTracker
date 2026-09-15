import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { budgetId as readableBudgetId, entriesRef, entryRef } from './paths'

/**
 * החלפת המזהה של תקציב קיים למזהה קריא.
 *
 * מזהה מסמך ב-Firestore אינו ניתן לשינוי, ולכן זו יצירה של תקציב
 * חדש והעברת כל מה שתלוי בו. הישן נמחק רק בסוף, אחרי אימות.
 *
 * הסדר כאן אינו שרירותי: כלל האבטחה דורש שמי שהזין שורה יהיה חבר
 * בתקציב שאליו היא נכתבת, ולכן שותפים חייבים להצטרף לתקציב החדש
 * לפני שמעתיקים שורות. לשם כך משמש מנגנון ההזמנה הקיים.
 */

const BATCH_LIMIT = 500

const subcollection = (budgetId, name) => collection(db, 'budgets', budgetId, name)

/** השם החדש שהתקציב יקבל, לתצוגה לפני שמחליטים. */
export const proposedId = (budget) =>
  readableBudgetId({ type: budget?.type || 'household', name: budget?.name })

/**
 * יוצר את התקציב החדש עם אותם שדות, ואת החברות של מי שמריץ.
 * שני שלבים ולא כתיבה אחת, מאותה סיבה שבמקור: הכלל שמאשר את מסמך
 * החבר קורא את ownerUid מהתקציב, והוא נקרא מהמצב שלפני הכתיבה.
 */
export async function createTarget({ budget, uid, displayName = '', newId }) {
  const targetId = newId || proposedId(budget)
  const type = budget.type || 'household'

  await setDoc(doc(db, 'budgets', targetId), {
    name: budget.name,
    ownerUid: uid,
    type,
    ...(type === 'household'
      ? {
          billingDay: budget.billingDay ?? 10,
          baseAmount: budget.baseAmount ?? 0,
        }
      : {
          frame: Number(budget.frame) || 0,
          linkedBudgetId: budget.linkedBudgetId ?? null,
        }),
    createdAt: serverTimestamp(),
    rekeyedFrom: budget.id,
  })

  const batch = writeBatch(db)
  batch.set(doc(db, 'budgets', targetId, 'members', uid), {
    uid,
    role: 'owner',
    displayName,
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'users', uid, 'memberships', targetId), {
    budgetId: targetId,
    joinedAt: serverTimestamp(),
  })
  await batch.commit()

  return targetId
}

/** מעתיק שורות ותבניות. חייב לרוץ אחרי שכל החברים הצטרפו. */
export async function copyContent({ oldId, newId }) {
  const [entries, templates] = await Promise.all([
    getDocs(entriesRef(oldId)),
    getDocs(subcollection(oldId, 'recurring')),
  ])

  for (let start = 0; start < entries.docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const item of entries.docs.slice(start, start + BATCH_LIMIT)) {
      batch.set(entryRef(newId, item.id), item.data())
    }
    await batch.commit()
  }

  for (let start = 0; start < templates.docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const item of templates.docs.slice(start, start + BATCH_LIMIT)) {
      batch.set(doc(db, 'budgets', newId, 'recurring', item.id), item.data())
    }
    await batch.commit()
  }

  return { entries: entries.docs.length, templates: templates.docs.length }
}

/** ספירה בשני הצדדים, אותו עיקרון כמו באימות המיגרציה הקודמת. */
export async function verifyRekey({ oldId, newId }) {
  const [oldEntries, newEntries, oldMembers, newMembers] = await Promise.all([
    getDocs(entriesRef(oldId)),
    getDocs(entriesRef(newId)),
    getDocs(subcollection(oldId, 'members')),
    getDocs(subcollection(newId, 'members')),
  ])

  const sum = (snapshot) =>
    snapshot.docs.reduce((total, item) => total + (item.data().actualAmount || 0), 0)

  return {
    oldEntries: oldEntries.docs.length,
    newEntries: newEntries.docs.length,
    oldMembers: oldMembers.docs.length,
    newMembers: newMembers.docs.length,
    oldTotal: sum(oldEntries),
    newTotal: sum(newEntries),
    ok:
      oldEntries.docs.length === newEntries.docs.length &&
      sum(oldEntries) === sum(newEntries) &&
      oldMembers.docs.length === newMembers.docs.length,
  }
}

/**
 * מפנה את מי שמצביע על התקציב הישן, ומוחק אותו.
 * תקציב מסגרת שמקושר לבית משאיר אחריו שורות מסכמות שמזהה שלהן נגזר
 * מהמזהה הישן, ולכן הן נמחקות כאן. הן ייווצרו מחדש מאליהן בכניסה
 * הבאה למסך הטיול, עם המזהה החדש.
 */
export async function finishRekey({ oldId, newId, uid, budgets = [] }) {
  // תקציבי מסגרת שמקושרים לתקציב הזה
  for (const other of budgets) {
    if (other.linkedBudgetId === oldId) {
      await setDoc(doc(db, 'budgets', other.id), { linkedBudgetId: newId }, { merge: true })
    }
  }

  // שורות מסכמות שהתקציב הזה יצר בתקציב אחר
  if (oldId && budgets.some((other) => other.id !== oldId)) {
    for (const other of budgets) {
      if (other.id === oldId) continue
      const rows = await getDocs(
        query(entriesRef(other.id), where('linkedTripId', '==', oldId)),
      )
      const batch = writeBatch(db)
      for (const row of rows.docs) batch.delete(row.ref)
      if (rows.docs.length > 0) await batch.commit()
    }
  }

  await deleteOldBudget({ oldId, uid })
  return { oldId, newId }
}

/** מוחק את התקציב הישן על כל תת האוספים שלו. */
export async function deleteOldBudget({ oldId, uid }) {
  const [entries, templates, members] = await Promise.all([
    getDocs(entriesRef(oldId)),
    getDocs(subcollection(oldId, 'recurring')),
    getDocs(subcollection(oldId, 'members')),
  ])

  const all = [...entries.docs, ...templates.docs]
  for (let start = 0; start < all.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const item of all.slice(start, start + BATCH_LIMIT)) batch.delete(item.ref)
    await batch.commit()
  }

  // מסמך חבר נמחק בידי עצמו או בידי הבעלים, ולכן הבעלים אחרון
  const batch = writeBatch(db)
  for (const member of members.docs) batch.delete(member.ref)
  batch.delete(doc(db, 'users', uid, 'memberships', oldId))
  batch.delete(doc(db, 'budgets', oldId))
  await batch.commit()

  return { deleted: all.length + members.docs.length }
}

/** האם המזהה כבר קריא, כלומר אין מה להעביר. */
export const alreadyReadable = (id) => /^(household|trip|goal)_/.test(id)

export async function targetExists(newId) {
  const snapshot = await getDoc(doc(db, 'budgets', newId))
  return snapshot.exists()
}

/**
 * גיבוי של כל הרשומות בתקציבים שאתם חברים בהם.
 * שווה להריץ לפני כל שינוי מבנה, וזה הדבר היחיד שאי אפשר לשחזר
 * ממנו אם משהו משתבש.
 */
export async function backupAll(budgetIds = []) {
  const byBudget = {}
  for (const budgetId of budgetIds) {
    const snapshot = await getDocs(entriesRef(budgetId))
    byBudget[budgetId] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }
  return { takenAt: new Date().toISOString(), entries: byBudget }
}

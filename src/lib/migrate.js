import { getDocs, query, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { entriesRef, entryId, entryRef, isDerivedId, legacyEntriesRef } from './paths'

/**
 * העברה חד פעמית של רשומות מהאוסף הישן ברמה העליונה אל תת האוסף של
 * כל תקציב. רצה מהדפדפן כשאתם מחוברים, ולכן היא מוגבלת בדיוק לתקציבים
 * שאתם חברים בהם, בלי מפתח שירות ובלי הרשאות אדמין.
 *
 * היא לא מוחקת כלום. המחיקה היא פעולה נפרדת שנעשית רק אחרי שראיתם
 * שהכל במקום, וכך תמיד יש לאן לחזור.
 */

const BATCH_LIMIT = 500

/** רשומות התקציב באוסף הישן. */
export async function readLegacy(budgetId) {
  const snapshot = await getDocs(
    query(legacyEntriesRef(), where('budgetId', '==', budgetId)),
  )
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

/**
 * המזהה שהרשומה תקבל במקום החדש.
 * מזהה נגזר נשמר כלשונו, כי הוא מה שמונע כפילויות בחודשים הבאים.
 */
export function targetId(item) {
  return isDerivedId(item.id) ? item.id : entryId(item)
}

/** גוף הרשומה במקום החדש: בלי המזהה ובלי budgetId, שנמצא עכשיו בנתיב. */
export function targetBody(item) {
  const body = { ...item }
  delete body.id
  delete body.budgetId
  return body
}

/** גיבוי מלא של מה שקיים היום, לפני שנוגעים במשהו. */
export async function snapshotForBackup(budgetIds) {
  const byBudget = {}
  for (const budgetId of budgetIds) {
    byBudget[budgetId] = await readLegacy(budgetId)
  }
  return { takenAt: new Date().toISOString(), entries: byBudget }
}

/**
 * מעתיקה את הרשומות של תקציב אחד אל תת האוסף שלו.
 * setDoc ולא addDoc: הרצה שנייה כותבת מעל אותם מסמכים במקום לשכפל,
 * כך שאם המיגרציה נקטעה באמצע אפשר פשוט להריץ אותה שוב.
 */
export async function migrateBudget(budgetId) {
  const items = await readLegacy(budgetId)
  let written = 0

  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const slice = items.slice(start, start + BATCH_LIMIT)
    const batch = writeBatch(db)
    for (const item of slice) {
      batch.set(entryRef(budgetId, targetId(item)), targetBody(item))
    }
    await batch.commit()
    written += slice.length
  }

  return { budgetId, read: items.length, written }
}

/** בדיקה שאחרי ההעתקה יש במקום החדש בדיוק מה שהיה בישן. */
export async function verifyBudget(budgetId) {
  const [legacy, moved] = await Promise.all([
    readLegacy(budgetId),
    getDocs(entriesRef(budgetId)),
  ])

  const sum = (list) => list.reduce((total, item) => total + (item.actualAmount || 0), 0)
  const movedItems = moved.docs.map((item) => item.data())

  return {
    budgetId,
    legacyCount: legacy.length,
    movedCount: movedItems.length,
    legacyTotal: sum(legacy),
    movedTotal: sum(movedItems),
    ok: legacy.length === movedItems.length && sum(legacy) === sum(movedItems),
  }
}

/**
 * מה בדיוק לא עבר, וזה הדבר היחיד שאפשר לעשות איתו משהו.
 * ספירה שלא מסתדרת אומרת שיש בעיה, והאבחון אומר איזו.
 */
export async function diagnose(budgetId) {
  const [legacy, movedSnapshot] = await Promise.all([
    readLegacy(budgetId),
    getDocs(entriesRef(budgetId)),
  ])

  const movedIds = new Set(movedSnapshot.docs.map((item) => item.id))
  const byTarget = new Map()
  for (const item of legacy) {
    const target = targetId(item)
    if (!byTarget.has(target)) byTarget.set(target, [])
    byTarget.get(target).push(item)
  }

  // שתי רשומות שונות שמקבלות אותו מזהה: השנייה דורסת את הראשונה
  const collisions = [...byTarget.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([target, items]) => ({ target, names: items.map((item) => item.name) }))

  const missing = legacy
    .filter((item) => !isDerivedId(item.id) || !movedIds.has(item.id))
    .filter((item) => isDerivedId(item.id))
    .map((item) => ({ id: item.id, name: item.name, month: item.month }))

  const noMonth = legacy.filter((item) => !item.month)
    .map((item) => ({ id: item.id, name: item.name }))

  return {
    legacyCount: legacy.length,
    movedCount: movedIds.size,
    collisions,
    missingDerived: missing,
    noMonth,
  }
}

/** מחיקת האוסף הישן. נפרדת בכוונה, ורק אחרי אימות. */
export async function dropLegacy(budgetId) {
  const items = await readLegacy(budgetId)
  const snapshot = await getDocs(
    query(legacyEntriesRef(), where('budgetId', '==', budgetId)),
  )

  for (let start = 0; start < snapshot.docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const item of snapshot.docs.slice(start, start + BATCH_LIMIT)) {
      batch.delete(item.ref)
    }
    await batch.commit()
  }

  return { budgetId, deleted: items.length }
}

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { CATEGORIES } from './model'

const templatesRef = (budgetId) => collection(db, 'budgets', budgetId, 'recurring')

/**
 * מזהה השורה נגזר מהתבנית ומהחודש, ולכן הוא זהה בכל מכשיר.
 * זה מה שמונע כפילות כששני בני הזוג פותחים את אותו חודש בו-זמנית:
 * שתי הכתיבות פונות בדיוק לאותו מסמך.
 */
export const materializedEntryId = (recurringId, month) => `${recurringId}__${month}`

export function watchTemplates(budgetId, onChange, onError) {
  return onSnapshot(
    templatesRef(budgetId),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  )
}

export function createTemplate({ budgetId, uid, month, category, name, plannedAmount, actualAmount }) {
  const ref = doc(templatesRef(budgetId))
  return setDoc(ref, {
    category,
    budgetGroup: CATEGORIES[category].budgetGroup,
    name: name.trim(),
    plannedAmount: Number(plannedAmount) || 0,
    actualAmount: Number(actualAmount) || 0,
    startMonth: month,
    active: true,
    skipMonths: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
  }).then(() => ref.id)
}

/** דילוג על חודש בודד, למשל כשמוחקים שורה שנוצרה מתבנית. */
export function skipMonth(budgetId, recurringId, month) {
  return updateDoc(doc(templatesRef(budgetId), recurringId), {
    skipMonths: arrayUnion(month),
  })
}

/** הפסקת החיוב הקבוע. שורות שכבר נוצרו בחודשים קודמים נשארות. */
export function stopTemplate(budgetId, recurringId) {
  return deleteDoc(doc(templatesRef(budgetId), recurringId))
}

/**
 * אילו תבניות אמורות להופיע בחודש הזה ועדיין אין להן שורה.
 * הפונקציה טהורה כדי שאפשר יהיה לבדוק אותה בלי Firestore.
 */
export function pendingTemplates(templates, entries, month) {
  const existing = new Set(entries.map((entry) => entry.recurringId).filter(Boolean))
  return templates.filter((template) =>
    template.active &&
    template.startMonth <= month &&
    !(template.skipMonths || []).includes(month) &&
    !existing.has(template.id),
  )
}

/** שורת החודש שנגזרת מתבנית. */
export function entryFromTemplate(template, { budgetId, month, uid }) {
  return {
    budgetId,
    month,
    category: template.category,
    budgetGroup: template.budgetGroup,
    name: template.name,
    plannedAmount: template.plannedAmount,
    actualAmount: template.actualAmount,
    note: '',
    addedBy: uid,
    recurringId: template.id,
  }
}

/** יוצר בפועל את השורות החסרות. setDoc עם מזהה קבוע הוא אידמפוטנטי. */
export function materialize(templates, { budgetId, month, uid }) {
  return Promise.all(
    templates.map((template) =>
      setDoc(
        doc(db, 'entries', materializedEntryId(template.id, month)),
        entryFromTemplate(template, { budgetId, month, uid }),
      ),
    ),
  )
}

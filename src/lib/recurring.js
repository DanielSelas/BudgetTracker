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
import { entryRef } from './paths'
import { CATEGORIES, shiftMonth } from './model'
import { recurringId as readableRecurringId } from './paths'

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

export function createTemplate({
  budgetId, uid, month, category, name, plannedAmount, actualAmount,
  groupKey = '', endMonth = '', offCard = false, dueDay = 0,
}) {
  const ref = doc(templatesRef(budgetId), readableRecurringId({ category, name }))
  return setDoc(ref, {
    category,
    budgetGroup: CATEGORIES[category].budgetGroup,
    name: name.trim(),
    plannedAmount: Number(plannedAmount) || 0,
    actualAmount: Number(actualAmount) || 0,
    startMonth: month,
    // חיוב קבוע אינו לנצח: שכירות היא לשנה, ביטוח לשנה, והלוואה
    // למספר תשלומים ידוע. בלי סיום, כל מבט קדימה מניח התחייבות
    // שכבר לא קיימת.
    ...(endMonth ? { endMonth } : {}),
    // חיוב שיורד ישירות מהחשבון, כמו הוראת קבע או צ׳ק, ולכן אינו
    // חלק מחיוב האשראי החודשי
    ...(offCard ? { offCard: true } : {}),
    // היום בחודש שבו זה קורה. רלוונטי להכנסה ולחיוב שיורד ישירות
    // מהחשבון; מה שעובר בכרטיס נגבה במועד החיוב של הכרטיס
    ...(dueDay ? { dueDay: Number(dueDay) } : {}),
    active: true,
    skipMonths: [],
    createdBy: uid,
    ...(groupKey ? { groupKey } : {}),
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
    !isEnded(template, month) &&
    !(template.skipMonths || []).includes(month) &&
    !existing.has(template.id),
  )
}

/** החודש האחרון שבו החיוב נוצר. חודש ריק פירושו בלי סיום. */
export const isEnded = (template, month) =>
  Boolean(template?.endMonth) && month > template.endMonth

/**
 * התחייבויות שנגמרות החודש או בחודש הבא.
 * זה הרגע שבו מחדשים שכירות או ביטוח, ולכן שווה לומר אותו לפני
 * שהחיוב פשוט מפסיק להופיע בלי הסבר.
 */
export function endingSoon(templates = [], month) {
  const next = shiftMonth(month, 1)
  return templates
    .filter((template) => template.active && template.endMonth)
    .filter((template) => template.endMonth === month || template.endMonth === next)
    .map((template) => ({ ...template, endsThisMonth: template.endMonth === month }))
}

/** מספר תשלומים מתורגם לחודש הסיום, כי בנתונים נשמר מושג אחד. */
export function endAfterPayments(startMonth, payments) {
  const count = Number(payments)
  if (!startMonth || !Number.isInteger(count) || count < 1) return ''
  return shiftMonth(startMonth, count - 1)
}

/** שורת החודש שנגזרת מתבנית. */
export function entryFromTemplate(template, { month, uid }) {
  return {
    month,
    category: template.category,
    budgetGroup: template.budgetGroup,
    name: template.name,
    plannedAmount: template.plannedAmount,
    actualAmount: template.actualAmount,
    note: '',
    addedBy: uid,
    recurringId: template.id,
    // הקיבוץ נשמר על התבנית, אחרת חיוב קבוע מקובץ היה יוצא מהקבוצה
    // שלו בכל חודש חדש
    ...(template.groupKey ? { groupKey: template.groupKey } : {}),
  }
}

/** יוצר בפועל את השורות החסרות. setDoc עם מזהה קבוע הוא אידמפוטנטי. */
export function materialize(templates, { budgetId, month, uid }) {
  return Promise.all(
    templates.map((template) =>
      setDoc(
        entryRef(budgetId, materializedEntryId(template.id, month)),
        entryFromTemplate(template, { month, uid }),
      ),
    ),
  )
}

/** מזהי התבניות שאינן עוברות בכרטיס. */
export const offCardIds = (templates = []) =>
  new Set(templates.filter((template) => template.offCard).map((template) => template.id))

/**
 * מה ייגבה בכרטיס במועד החיוב, ומה יורד ישירות מהחשבון.
 *
 * ההנחה היא שכל הוצאה עוברת בכרטיס, כי זה נכון ברוב המוחלט של
 * המקרים. היוצאים מן הכלל הם חיובים קבועים שסומנו, וזה גם המקום
 * היחיד שבו סימון כזה לא מוסיף חיכוך להזנה יומיומית.
 */
export function upcomingCharge(entries = [], templates = []) {
  const off = offCardIds(templates)
  const sum = (list) => list.reduce((total, item) => total + (item.actualAmount || 0), 0)

  const income = entries.filter((entry) => entry.category === 'income')
  const spending = entries.filter((entry) => entry.category !== 'income')
  const direct = spending.filter((entry) => entry.recurringId && off.has(entry.recurringId))
  const card = spending.filter((entry) => !(entry.recurringId && off.has(entry.recurringId)))

  return {
    card: sum(card),
    cardRows: card.length,
    direct: sum(direct),
    directRows: direct,
    income: sum(income),
    left: sum(income) - sum(spending),
  }
}

import { arrayUnion, doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { entryRef } from './paths'

/**
 * ניקוי רשומות ישנות.
 *
 * הסיווג השתנה, ותיקון של היסטוריה שלמה שורה אחר שורה אינו שווה את
 * העבודה. מה שכן שווה הוא למחוק את מה שכבר לא נכון ולהתחיל נקי.
 *
 * הפונקציה שמתכננת טהורה ונפרדת מזו שמוחקת, כי מחיקה שאי אפשר לראות
 * לפני שהיא קורית היא בדיוק מה שאסור לבנות.
 */

const BATCH_LIMIT = 500
const MAX_SKIP_MONTHS = 120

/**
 * מה יימחק ומה יישאר.
 * חודש הגבול עצמו נשאר: "עד ספטמבר" פירושו שספטמבר נשמר.
 */
export function cleanupPlan(entries = [], { before, keepIncome = true }) {
  const doomed = []
  const kept = []

  for (const entry of entries) {
    const old = Boolean(before) && entry.month < before
    const spared = keepIncome && entry.category === 'income'
    if (old && !spared) doomed.push(entry)
    else kept.push(entry)
  }

  const byMonth = new Map()
  for (const entry of doomed) {
    if (!byMonth.has(entry.month)) byMonth.set(entry.month, { month: entry.month, count: 0, total: 0 })
    const bucket = byMonth.get(entry.month)
    bucket.count += 1
    bucket.total += Number(entry.actualAmount) || 0
  }

  return {
    doomed,
    kept: kept.length,
    keptIncome: kept.filter((entry) => entry.category === 'income' && entry.month < before).length,
    months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}

/**
 * אילו חודשים לסמן כמדולגים בכל תבנית.
 *
 * בלי זה המחיקה מתבטלת מעצמה: פתיחת חודש שנמחק יוצרת מחדש את השורות
 * של כל חיוב קבוע שחל בו. מסומנים רק החודשים שבהם באמת הייתה שורה
 * של אותה תבנית, ולא כל הטווח.
 */
export function skipsFor(doomed = []) {
  const byTemplate = new Map()
  for (const entry of doomed) {
    if (!entry.recurringId) continue
    if (!byTemplate.has(entry.recurringId)) byTemplate.set(entry.recurringId, new Set())
    byTemplate.get(entry.recurringId).add(entry.month)
  }
  return byTemplate
}

export async function runCleanup({ budgetId, entries, before, keepIncome = true }) {
  const plan = cleanupPlan(entries, { before, keepIncome })

  for (let start = 0; start < plan.doomed.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const entry of plan.doomed.slice(start, start + BATCH_LIMIT)) {
      batch.delete(entryRef(budgetId, entry.id))
    }
    await batch.commit()
  }

  // הדילוגים אחרי המחיקה: אם הכתיבה הזאת נכשלת, המחיקה כבר תקפה
  // וניתן להריץ שוב, ואילו הסדר ההפוך היה משאיר דילוגים בלי מחיקה
  const skips = skipsFor(plan.doomed)
  const templatesRef = (id) => doc(db, 'budgets', budgetId, 'recurring', id)
  for (const [recurringId, months] of skips) {
    await writeBatch(db)
      .update(templatesRef(recurringId), {
        skipMonths: arrayUnion(...[...months].slice(0, MAX_SKIP_MONTHS)),
      })
      .commit()
  }

  return { deleted: plan.doomed.length, skipped: skips.size }
}

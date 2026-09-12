export const CATEGORIES = {
  income: { label: 'הכנסות', budgetGroup: 'none' },
  fixed: { label: 'קבועות', budgetGroup: 'fixed' },
  leisure: { label: 'פנאי', budgetGroup: 'leisure' },
  fund: { label: 'קרן', budgetGroup: 'savings' },
}

export const BUDGET_GROUP_RATIOS = {
  fixed: 0.5,
  leisure: 0.3,
  savings: 0.2,
}

export const BASE_STEP = 5000

/**
 * הכפולה הקרובה של 5,000 שקטנה ממש מההכנסה בפועל.
 * הכנסה של 25,000 בדיוק נותנת בסיס 20,000 (ולא 25,000).
 */
export function calcBaseAmount(totalIncome) {
  if (!Number.isFinite(totalIncome) || totalIncome <= 0) return 0
  return Math.max(0, Math.floor((totalIncome - 1) / BASE_STEP) * BASE_STEP)
}

/** המרווח הנזיל ("בלתם"), מה שנשאר בעו"ש ולא חולק לקטגוריות. */
export function calcUnplanned(totalIncome, baseAmount) {
  return Math.max(0, totalIncome - baseAmount)
}

/** היעד הכספי של קבוצת תקציב לפי 50/30/20 מתוך סכום הבסיס. */
export function groupTarget(baseAmount, budgetGroup) {
  return baseAmount * (BUDGET_GROUP_RATIOS[budgetGroup] ?? 0)
}

/** פורמט חודש כמו שנשמר ב-Firestore: 2026-09 */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * כל החישובים של מסך החודש במקום אחד, כפונקציה טהורה.
 * baseAmount נגזר מההכנסה בפועל ולעולם אינו נתון לעריכה ידנית.
 */
export function summarizeMonth(entries) {
  const sumActual = (list) => list.reduce((total, entry) => total + (entry.actualAmount || 0), 0)
  const sumPlanned = (list) => list.reduce((total, entry) => total + (entry.plannedAmount || 0), 0)

  const income = entries.filter((entry) => entry.category === 'income')
  const expenses = entries.filter((entry) => entry.category !== 'income')

  const totalIncome = sumActual(income)
  const totalExpenses = sumActual(expenses)
  const baseAmount = calcBaseAmount(totalIncome)

  const groups = {}
  for (const group of Object.keys(BUDGET_GROUP_RATIOS)) {
    const inGroup = entries.filter((entry) => entry.budgetGroup === group)
    const actual = sumActual(inGroup)
    const target = groupTarget(baseAmount, group)
    groups[group] = {
      actual,
      planned: sumPlanned(inGroup),
      target,
      remaining: target - actual, // שלילי = חריגה מהיעד
      deviation: actual - target,
      ratio: target > 0 ? actual / target : 0,
    }
  }

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    baseAmount,
    unplanned: calcUnplanned(totalIncome, baseAmount),
    groups,
  }
}

/** מזיז מפתח חודש קדימה או אחורה, עם גלישת שנה. */
export function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return monthKey(date)
}

/**
 * האם חריגה כלפי מעלה בקבוצה הזו היא דבר טוב.
 * בחיסכון כן: הפקדה מעל היעד היא מצב תקין ורצוי, לא חריגה.
 */
export function isOverageGood(budgetGroup) {
  return budgetGroup === 'savings'
}

/**
 * האם הפער בין המתוכנן לבפועל בשורה בודדת ראוי לסימון אזהרה.
 * בהוצאות, כשהוצאנו יותר מהמתוכנן. בהכנסות, כשהכנסנו פחות.
 * בהפקדות לקרן אין אזהרה: כל סכום מעל התכנון הוא רצוי.
 */
export function isEntryConcerning(entry) {
  const planned = entry.plannedAmount || 0
  const actual = entry.actualAmount || 0
  if (planned <= 0) return false
  if (entry.category === 'income') return actual < planned
  if (entry.category === 'fund') return false
  return actual > planned
}

export const CATEGORIES = {
  income: { label: 'הכנסות', budgetGroup: 'none' },
  fixed: { label: 'קבועות', budgetGroup: 'fixed' },
  leisure: { label: 'פנאי', budgetGroup: 'leisure' },
  fund: { label: 'קרן', budgetGroup: 'savings' },
  // בלתם היא רזרבה אמיתית שאפשר להוציא ממנה, ולא רק מספר מחושב.
  // היא מחוץ ל-50/30/20 בכוונה: היא הכסף שלא חולק לקטגוריות.
  unplanned: { label: 'בלתם', budgetGroup: 'none' },
}

export const BUDGET_GROUP_RATIOS = {
  fixed: 0.5,
  leisure: 0.3,
  savings: 0.2,
}

export const BASE_STEP = 5000

/**
 * מועד החיוב של כרטיסי האשראי. חברות האשראי מציעות את שלושת אלה,
 * ולכן הם הקיצורים, אבל אפשר לבחור כל יום: לפעמים אנשים משנים.
 */
export const BILLING_DAYS = [2, 10, 15]
export const DEFAULT_BILLING_DAY = 10

export const isBillingDay = (day) => Number.isInteger(day) && day >= 1 && day <= 28

/**
 * חלון החיוב של החודש: מיום החיוב בחודש הזה ועד אותו יום בחודש הבא.
 * זה מה שהחיוב הקרוב באמת מכסה, ולכן הוא מוצג מתחת לשם החודש.
 *
 * מילה במקום מקף: מקף בין שני מספרים בתוך טקסט עברי הוא תו ניטרלי
 * ועלול להתהפך בתצוגה. כאן זו כבר הפעם השלישית בפרויקט.
 */
export function billingWindow(month, day) {
  const billingDay = Number(day)
  if (!month || !isBillingDay(billingDay)) return ''
  const [, rawMonth] = month.split('-').map(Number)
  const nextMonth = rawMonth === 12 ? 1 : rawMonth + 1
  return `${billingDay}.${rawMonth} עד ${billingDay}.${nextMonth}`
}

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
  const unplannedEntries = entries.filter((entry) => entry.category === 'unplanned')

  const totalIncome = sumActual(income)
  const totalExpenses = sumActual(expenses)
  const baseAmount = calcBaseAmount(totalIncome)

  // הרזרבה היא המרווח הנזיל; מה שהוצא ממנה מקטין אותה בזמן אמת
  const reserve = calcUnplanned(totalIncome, baseAmount)
  const unplannedSpent = sumActual(unplannedEntries)

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
    unplanned: {
      reserve,
      spent: unplannedSpent,
      remaining: reserve - unplannedSpent,
      planned: sumPlanned(unplannedEntries),
    },
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

/* ===== סוגי תקציב ===== */

export const BUDGET_TYPES = {
  household: {
    label: 'משק בית',
    hint: 'חודש אחרי חודש, לפי עקרון 50/30/20 מתוך ההכנסה.',
  },
  trip: {
    label: 'טיול',
    hint: 'מסגרת אחת לכל הטיול, בלי חודשים ובלי יעדים לכל קטגוריה.',
  },
  goal: {
    label: 'מטרת חיסכון',
    hint: 'סכום יעד שמצטברים אליו. הפס מתמלא במקום להתרוקן.',
  },
}

/**
 * תקציבים שנוצרו לפני שהיה שדה type הם משק בית, וכך גם סוג שאינו מוכר.
 * נגזר מ-BUDGET_TYPES ולא מרשימה קשיחה, אחרת סוג חדש נבלע בשקט
 * ונפתח כמסך הלא נכון.
 */
export const budgetType = (budget) =>
  (budget?.type in BUDGET_TYPES ? budget.type : 'household')

export const isTrip = (budget) => budgetType(budget) === 'trip'

export const isGoal = (budget) => budgetType(budget) === 'goal'

/** טיול ומטרה חולקים צורה: סכום אחד שנקבע מראש, ורשומות מולו. */
export const isFrameBudget = (budget) => isTrip(budget) || isGoal(budget)

/**
 * קטגוריות הטיול. אין להן budgetGroup כי אין בטיול יחס 50/30/20,
 * רק מסגרת כוללת.
 */
export const TRIP_CATEGORIES = {
  lodging: { label: 'לינה' },
  transport: { label: 'התניידות' },
  attractions: { label: 'אטרקציות' },
  dining: { label: 'מסעדות' },
  shopping: { label: 'שופינג' },
  other: { label: 'אחר' },
}

export const TRIP_ORDER = Object.keys(TRIP_CATEGORIES)

/**
 * מטרת חיסכון. משיכה קיימת כי חיסכון אמיתי לא תמיד חד כיווני,
 * והיא מקטינה את מה שנצבר במקום להתווסף אליו.
 */
export const GOAL_CATEGORIES = {
  deposit: { label: 'הפקדה', sign: 1 },
  withdrawal: { label: 'משיכה', sign: -1 },
}

export const GOAL_ORDER = Object.keys(GOAL_CATEGORIES)

/** כל קטגוריה חוקית באפליקציה, לצורך ולידציה. */
export const ALL_CATEGORIES = [
  ...Object.keys(CATEGORIES), ...TRIP_ORDER, ...GOAL_ORDER,
]

/** סיכום טיול: מסגרת אחת, בלי בסיס ובלי יעדים לקטגוריה. */
export function summarizeTrip(entries, frame = 0) {
  const byCategory = Object.fromEntries(TRIP_ORDER.map((key) => [key, []]))
  let spent = 0

  for (const entry of entries) {
    const amount = entry.actualAmount || 0
    spent += amount
    const bucket = byCategory[entry.category] ? entry.category : 'other'
    byCategory[bucket].push(entry)
  }

  const totals = Object.fromEntries(
    TRIP_ORDER.map((key) => [
      key,
      byCategory[key].reduce((sum, entry) => sum + (entry.actualAmount || 0), 0),
    ]),
  )

  return {
    frame,
    spent,
    remaining: frame - spent,
    progress: frame > 0 ? Math.min(100, (spent / frame) * 100) : 0,
    byCategory,
    totals,
  }
}

/**
 * סיכום מטרת חיסכון. מראה כמה נצבר מתוך היעד, ולא כמה נשאר לבזבז.
 * משיכה מקטינה את הצבירה, ולכן היא יכולה לרדת בחזרה.
 */
export function summarizeGoal(entries, target = 0) {
  const byCategory = Object.fromEntries(GOAL_ORDER.map((key) => [key, []]))
  let saved = 0

  for (const entry of entries) {
    const bucket = byCategory[entry.category] ? entry.category : 'deposit'
    byCategory[bucket].push(entry)
    saved += (entry.actualAmount || 0) * GOAL_CATEGORIES[bucket].sign
  }

  const totals = Object.fromEntries(
    GOAL_ORDER.map((key) => [
      key,
      byCategory[key].reduce((sum, entry) => sum + (entry.actualAmount || 0), 0),
    ]),
  )

  return {
    target,
    saved,
    remaining: target - saved,
    reached: target > 0 && saved >= target,
    progress: target > 0 ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0,
    byCategory,
    totals,
  }
}

/** מפתח חודש מתוך תאריך רשומה, לצורך שיוך הוצאות טיול לחודש. */
export const monthOfDate = (date) => String(date || '').slice(0, 7)

/** תאריך היום בפורמט שנשמר ברשומה. */
export function todayDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

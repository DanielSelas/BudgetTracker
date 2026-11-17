export const CATEGORIES = {
  income: { label: 'הכנסות', budgetGroup: 'none' },
  fixed: { label: 'קבועות', budgetGroup: 'fixed' },
  // לא רק בילויים: כל מה שמשתנה מחודש לחודש, כולל שופינג ומסעדות
  leisure: { label: 'הוצאות משתנות', short: 'משתנות', budgetGroup: 'leisure' },
  fund: { label: 'הפקדות', budgetGroup: 'savings' },
  // מה שנכנס מעבר לסכום הבסיס. אפשר להוציא ממנו, אבל ההמלצה היא
  // להפקיד אותו: זה לא כסף שתוכנן, אלא כסף שנשאר.
  // היתרה היא הסכום שנשאר מעבר לתוכנית, והבלת״ם הוא מה שיוצא ממנה.
  // לכן הכרטיס נקרא יתרה והשורות שבתוכו הן בלת״ם.
  unplanned: { label: 'יתרה', short: 'בלת״ם', budgetGroup: 'none' },
}

/**
 * ברירת המחדל: 50/30/20. כלל אצבע ותו לא, ולכן אפשר לשנות אותו
 * לכל תקציב. תקציב שלא נגע בזה ממשיך לפיו בדיוק כמו קודם.
 */
export const BUDGET_GROUP_RATIOS = {
  fixed: 0.5,
  leisure: 0.3,
  savings: 0.2,
}

export const RATIO_GROUPS = ['fixed', 'leisure', 'savings']

/**
 * יחסים תקינים, או ברירת המחדל.
 *
 * שלושתם חייבים לסכום ל-100%. סכום אחר אינו "קרוב מספיק": הוא או
 * מחלק כסף שאינו קיים או משאיר כסף בלי בית, ובשני המקרים היעדים
 * משקרים. סטייה של אגורה בחישוב צף כן נסלחת.
 */
export function normalizeRatios(ratios) {
  if (!ratios) return BUDGET_GROUP_RATIOS
  const values = RATIO_GROUPS.map((group) => Number(ratios[group]))
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return BUDGET_GROUP_RATIOS
  const total = values.reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 1) > 0.0001) return BUDGET_GROUP_RATIOS
  return Object.fromEntries(RATIO_GROUPS.map((group, index) => [group, values[index]]))
}

/** החודש שממנו רשומה ראשונה בהיסטוריה תקפה, כלומר מאז ומעולם. */
export const PLAN_START = '0000-00'

/**
 * התוכנית שהייתה בתוקף בחודש מסוים: הבסיס והיחסים.
 *
 * חודש שעבר סגור. שינוי שנעשה היום תקף מהחודש הנוכחי והלאה, ולכן
 * כל שינוי נרשם עם החודש שממנו הוא חל, וחודש קורא את הרשומה
 * האחרונה שאינה מאוחרת ממנו. בלי זה שינוי של הבסיס היה מחשב מחדש
 * גם חודשים שכבר נסגרו, והיסטוריה הייתה משתנה מתחת לידיים.
 */
export function planFor(budget, month) {
  const history = Array.isArray(budget?.planHistory) ? budget.planHistory : []
  const match = history
    .filter((item) => item && typeof item.from === 'string' && item.from <= month)
    .sort((a, b) => a.from.localeCompare(b.from))
    .at(-1)

  const source = match || budget || {}
  return {
    baseAmount: Math.max(0, Number(source.baseAmount) || 0),
    ratios: normalizeRatios(source.ratios),
  }
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
/**
 * סכום הבסיס האוטומטי, כשהמשתמש לא קבע אחד בעצמו.
 * הגזירה מההכנסה נותנת מספר סביר בהתחלה, אבל היא גם אומרת שחודש טוב
 * מרשה לבזבז יותר, וזה הפוך מהרעיון של תקציב. לכן אפשר לקבוע בסיס
 * קבוע, ואז התוכנית היא שקובעת ולא מה שקרה החודש.
 */
export function calcBaseAmount(totalIncome) {
  if (!Number.isFinite(totalIncome) || totalIncome <= 0) return 0
  return Math.max(0, Math.floor((totalIncome - 1) / BASE_STEP) * BASE_STEP)
}

/** השארית: מה שנכנס מעבר לסכום הבסיס ולא חולק לקטגוריות. */
export function calcUnplanned(totalIncome, baseAmount) {
  return Math.max(0, totalIncome - baseAmount)
}

/** היעד הכספי של קבוצת תקציב, לפי היחסים של אותו חודש. */
export function groupTarget(baseAmount, budgetGroup, ratios = BUDGET_GROUP_RATIOS) {
  return baseAmount * (ratios[budgetGroup] ?? 0)
}

/** כמה שינויי תוכנית נשמרים. אחד לחודש לכל היותר, ולכן חמש שנים. */
export const PLAN_HISTORY_MAX = 60

/**
 * ההיסטוריה אחרי שינוי תוכנית.
 *
 * בשינוי הראשון נרשם גם מה שהיה עד כה, עם חודש התחלה ריק. בלי זה
 * חודשים ישנים היו נופלים לערך החדש ומשתנים למפרע, וזו בדיוק
 * ההבטחה שחודש סגור לא זז. שינוי נוסף באותו חודש דורס את הרשומה
 * שלו, אחרת כל תיקון של טעות היה מוסיף שורה.
 */
export function nextPlanHistory(budget, month, baseAmount, ratios) {
  const history = Array.isArray(budget?.planHistory) ? [...budget.planHistory] : []

  if (!history.length) {
    history.push({
      from: PLAN_START,
      baseAmount: Math.max(0, Number(budget?.baseAmount) || 0),
      ratios: normalizeRatios(budget?.ratios),
    })
  }

  const row = {
    from: month,
    baseAmount: Math.max(0, Number(baseAmount) || 0),
    ratios: normalizeRatios(ratios),
  }
  const at = history.findIndex((item) => item?.from === month)
  if (at >= 0) history[at] = row
  else history.push(row)

  history.sort((a, b) => String(a?.from).localeCompare(String(b?.from)))
  return history.slice(-PLAN_HISTORY_MAX)
}

/** פורמט חודש כמו שנשמר ב-Firestore: 2026-09 */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * כל החישובים של מסך החודש במקום אחד, כפונקציה טהורה.
 * baseAmount נגזר מההכנסה בפועל ולעולם אינו נתון לעריכה ידנית.
 */
export function summarizeMonth(entries, { fixedBase, ratios: given } = {}) {
  const ratios = normalizeRatios(given)
  const sumActual = (list) => list.reduce((total, entry) => total + (entry.actualAmount || 0), 0)
  const sumPlanned = (list) => list.reduce((total, entry) => total + (entry.plannedAmount || 0), 0)

  const income = entries.filter((entry) => entry.category === 'income')
  const expenses = entries.filter((entry) => entry.category !== 'income')
  const unplannedEntries = entries.filter((entry) => entry.category === 'unplanned')

  const totalIncome = sumActual(income)
  const totalExpenses = sumActual(expenses)
  // בסיס שנקבע ידנית גובר, אבל רק עד גובה ההכנסה: אי אפשר לתכנן
  // לחלק כסף שלא נכנס, ואחרת היעדים היו מראים מספרים שאינם קיימים
  const planned = Number(fixedBase) || 0
  const usesFixedBase = planned > 0
  const baseAmount = usesFixedBase
    ? Math.min(planned, totalIncome)
    : calcBaseAmount(totalIncome)

  // היתרה קטנה משני דברים: בלת״ם, והפקדה שנעשתה מתוכה.
  // בלי הספירה של ההפקדה היא הייתה נשארת על גובהה גם אחרי שהופקדה,
  // ואותו כסף היה מוצע להפקדה שוב ושוב.
  const reserve = calcUnplanned(totalIncome, baseAmount)
  const depositedFromRemainder = sumActual(entries.filter((entry) => entry.fromRemainder))
  const unplannedSpent = sumActual(unplannedEntries) + depositedFromRemainder

  const groups = {}
  for (const group of RATIO_GROUPS) {
    const inGroup = entries.filter((entry) => entry.budgetGroup === group)
    const actual = sumActual(inGroup)
    const target = groupTarget(baseAmount, group, ratios)
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
    // היחסים נוסעים עם הסיכום: מי שקורא אותו לא אמור לדעת מאיזה
    // חודש הוא בא כדי לדעת לפי מה הוא חושב
    ratios,
    baseAmount,
    usesFixedBase,
    // כמה מהבסיס שתוכנן לא נכנס בפועל, כדי שאפשר יהיה לומר זאת
    baseShortfall: usesFixedBase ? Math.max(0, planned - totalIncome) : 0,
    unplanned: {
      reserve,
      spent: unplannedSpent,
      deposited: depositedFromRemainder,
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

/** כמה חודשים מפרידים בין שני מפתחות חודש. */
export function monthsApart(from, to) {
  const [fromYear, fromMonth] = String(from).split('-').map(Number)
  const [toYear, toMonth] = String(to).split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/**
 * האם החיוב הקבוע חל בחודש הזה.
 *
 * לא כל חיוב קבוע הוא חודשי: ארנונה יורדת כל חודשיים, ביטוח יכול
 * להיות רבעוני. חודש הפתיחה הוא העוגן, וממנו נמנה הקצב, כך שאותה
 * תבנית נותנת את אותה תשובה בכל מכשיר ובלי לשמור היסטוריה.
 */
export function runsInMonth(template, month) {
  if (!template?.startMonth || month < template.startMonth) return false
  const every = Number(template.everyMonths) || 1
  if (every <= 1) return true
  return monthsApart(template.startMonth, month) % every === 0
}

/** החודש האחרון שבו החיוב נוצר. חודש ריק פירושו בלי סיום. */
export const isEnded = (template, month) =>
  Boolean(template?.endMonth) && month > template.endMonth

/** תיאור הקצב בעברית, כי "כל 2 חודשים" אינו עברית. */
export function intervalLabel(every) {
  const count = Number(every) || 1
  if (count <= 1) return 'כל חודש'
  if (count === 2) return 'כל חודשיים'
  return `כל ${count} חודשים`
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
    progress: frame > 0 ? Math.max(0, Math.min(100, (spent / frame) * 100)) : 0,
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

/**
 * חריגה מסך ההכנסות של החודש. זה סף אחר ממה שקורה ביעד קטגוריה:
 * כאן זה לא "שברת את התוכנית" אלא "החודש הזה אוכל מהחיסכון".
 *
 * מחזיר null כשעוד לא הוזנה הכנסה, כי בימים שלפני המשכורת כל הוצאה
 * הייתה נראית כמו חריגה וההתראה הייתה הופכת לרעש.
 */
export function incomeOverage(summary, addedAmount = 0) {
  if (!summary || summary.totalIncome <= 0) return null
  const after = summary.totalExpenses + Math.max(0, addedAmount)
  const gap = after - summary.totalIncome
  if (gap <= 0) return null
  return {
    gap,
    // האם ההוצאה הזו היא שחוצה את הקו, או שכבר היינו מעבר לו
    crossing: summary.totalExpenses <= summary.totalIncome,
  }
}

/** מה יצא בתוך התוכנית: שלוש הקבוצות, בלי בלת״ם. */
export function planSpent(summary) {
  if (!summary?.groups) return 0
  return RATIO_GROUPS
    .reduce((sum, group) => sum + (summary.groups[group]?.actual || 0), 0)
}

/** כמה נשאר בתוך התוכנית. בלת״ם יוצא מהעודף ולכן אינו נחסר כאן. */
export function planRemaining(summary) {
  return (summary?.baseAmount || 0) - planSpent(summary)
}

/**
 * האם החודש כבר לא יחזיק, ולמה.
 *
 * אפשר לומר את זה באמצע החודש ולא רק בסופו, כי כל חיוב קבוע מתממש
 * לשורה ברגע שהחודש נפתח: שכר הדירה, הביטוחים והמשכורות כבר בפנים
 * ביום הראשון. לכן ההשוואה הוגנת מהיום הראשון, ולא נקודת זמן.
 *
 * והיא תקפה רק לכיוון אחד. הוצאות רק עולות, ולכן "לא יחזיק" הוא
 * ודאי ולא יתהפך, בעוד ש"יחזיק" הוא ניחוש ולכן לא נאמר כאן לעולם.
 *
 * שני ספים, כמו בסיכום של סוף החודש: שבירת התוכנית פירושה שהעודף
 * שיועד להפקדה נאכל, וחריגה מההכנסה פירושה שנאכל החיסכון.
 *
 * ושותק עד שיש הכנסה אחת לכל חבר בתקציב, כי עד אז צד ההכנסה חלקי
 * וכל חריגה שתוצג היא רעש.
 */
export function monthOutlook(summary, { incomeCount = 0, memberCount = 1 } = {}) {
  if (!summary || summary.totalIncome <= 0) return null

  // הכנסה משתנה מחודש לחודש, ולכן אין להתריע כל עוד צד ההכנסה חלקי:
  // בתקציב של שניים, משכורת אחת שהוזנה נראית כמו חודש שנשבר, וזו
  // אזהרת שווא. אזהרת שווא אחת מספיקה כדי שיפסיקו להאמין לכולן.
  if (incomeCount < Math.max(1, memberCount)) return null

  const worst = overspentGroups(summary)[0] || null
  const over = incomeOverage(summary)
  if (over) return { level: 'income', gap: over.gap, worst }

  const remaining = planRemaining(summary)
  if (summary.baseAmount > 0 && remaining < 0) {
    return { level: 'plan', gap: -remaining, worst }
  }

  return null
}

/** באילו קבוצות חרגתם מהיעד, מהגדולה לקטנה. */
export function overspentGroups(summary) {
  if (!summary?.groups) return []
  return Object.entries(summary.groups)
    .filter(([group, data]) => data.target > 0 && data.deviation > 0 && !isOverageGood(group))
    .map(([group, data]) => ({ group, over: data.deviation, target: data.target }))
    .sort((a, b) => b.over - a.over)
}

/**
 * החודש שהאפליקציה צריכה לפתוח בו, לפי מועד החיוב.
 *
 * מחזור ספטמבר עם חיוב ב-10 רץ מ-10.9 עד 10.10, ולכן ב-5 באוקטובר
 * עדיין מסיימים את ספטמבר ולא מתחילים את אוקטובר. בלי זה האפליקציה
 * הייתה קופצת לחודש חדש בזמן שהחודש הקודם עוד פתוח לגמרי.
 *
 * בלי מועד חיוב מתנהגת בדיוק כמו קודם, לפי הלוח.
 */
export function activeMonth(billingDay, now = new Date()) {
  const day = Number(billingDay)
  const current = monthKey(now)
  if (!isBillingDay(day)) return current
  return now.getDate() < day ? shiftMonth(current, -1) : current
}

/**
 * האם המחזור של החודש הזה כבר הסתיים.
 * מחזור ספטמבר נסגר במועד החיוב של אוקטובר, ולכן רק מאותו יום אפשר
 * לומר משהו על איך החודש נגמר.
 */
export function isMonthClosed(month, billingDay, now = new Date()) {
  if (!month) return false
  const day = Number(billingDay)
  if (!isBillingDay(day)) return month < monthKey(now)
  return month < activeMonth(day, now)
}

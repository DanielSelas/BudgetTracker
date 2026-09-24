import { isEnded, monthKey, runsInMonth, shiftMonth } from './model'
import { parseInstallment } from './importRows'

/**
 * כמה כסף באמת פנוי, לחודש הזה ולחודשים שאחריו.
 *
 * זו לא יתרה ולא תחזית סטטיסטית. היתרה דורשת עדכון ידני מתמיד,
 * ותחזית מהיסטוריה של פחות משלוש שנים היא ניחוש שמתחזה לידיעה:
 * שני אוגוסטים שנבדלים פי עשרה אינם עונתיות.
 *
 * מה שכן ידוע בוודאות הוא ההתחייבויות. שכירות, ביטוח והלוואה יש
 * להן סכום ותאריך סיום, ולתשלומים יש מספר. מהן נבנה קו של חודשים
 * קדימה, וההיסטוריה משמשת רק לדבר אחד: כמה עולה חודש רגיל.
 *
 * וכל זה שמרני בכוונה. ההכנסה מוקרנת לפי הרצפה ולא לפי הממוצע, כי
 * שתי משכורות משתנות. חודש טוב צריך להיות הפתעה לטובה, לא סטייה.
 */

const MONTHS_AHEAD = 12
const HISTORY_MONTHS = 12

const sum = (list) => list.reduce((total, item) => total + (Number(item) || 0), 0)

export function median(values = []) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * הוצאה משתנה של חודש: מה שאינו הכנסה, אינו נגזר מחיוב קבוע, ואינו
 * מסומן כחד פעמי.
 *
 * חיוב קבוע מוחסר כבר כהתחייבות, ולכן ספירה שלו כאן הייתה כפולה.
 * חד פעמי יוצא כי הוא לא מלמד מה רגיל, וזו כל מטרת הסימון.
 */
export const variableOf = (entries = []) =>
  sum(entries
    .filter((entry) => entry.category !== 'income' && !entry.recurringId && !entry.oneOff)
    .map((entry) => entry.actualAmount))

export const incomeOf = (entries = []) =>
  sum(entries.filter((entry) => entry.category === 'income').map((entry) => entry.actualAmount))

/** קיבוץ רשומות לפי חודש, כי ההיסטוריה מגיעה כרשימה אחת שטוחה. */
export function byMonth(entries = []) {
  const months = new Map()
  for (const entry of entries) {
    if (!entry.month) continue
    if (!months.has(entry.month)) months.set(entry.month, [])
    months.get(entry.month).push(entry)
  }
  return months
}

/**
 * כמה עולה חודש רגיל.
 *
 * חציון ולא ממוצע: ממוצע נגרר אחרי החודש החריג, וזה בדיוק החודש
 * שאותו רוצים להוציא מהחשבון. החודש הנוכחי אינו נספר כי הוא עדיין
 * לא נגמר, וחודש בלי שום הוצאה אינו חודש זול אלא חודש שלא הוזן.
 */
export function typicalVariable(entries = [], { now = monthKey(), months = HISTORY_MONTHS } = {}) {
  const oldest = shiftMonth(now, -months)
  const values = []
  for (const [month, list] of byMonth(entries)) {
    if (month >= now || month < oldest) continue
    const value = variableOf(list)
    if (value > 0) values.push(value)
  }
  return { amount: median(values), months: values.length }
}

/**
 * רצפת ההכנסה.
 *
 * תבנית הכנסה חוזרת היא התחייבות ידועה, ולכן היא הרצפה. בלעדיה
 * הרצפה היא החודש הנמוך ביותר שנצפה, ולא הממוצע: משכורת שמשתנה
 * מחודש לחודש מחייבת לתכנן לפי הרע ולא לפי הטוב.
 */
export function incomeFloor(entries = [], templates = [], month, { now = monthKey() } = {}) {
  const recurring = templates.filter((template) =>
    template.active
    && template.category === 'income'
    && runsInMonth(template, month)
    && !isEnded(template, month))
  if (recurring.length > 0) {
    return { amount: sum(recurring.map((t) => t.actualAmount)), source: 'recurring' }
  }

  const seen = []
  for (const [key, list] of byMonth(entries)) {
    if (key >= now) continue
    const value = incomeOf(list)
    // חודש בלי הכנסה הוא חודש שלא הוזן, ולא חודש בלי משכורת
    if (value > 0) seen.push(value)
  }
  return { amount: seen.length > 0 ? Math.min(...seen) : 0, source: seen.length ? 'lowest' : 'none' }
}

/** ההתחייבויות הקבועות של חודש מסוים, לפי התבניות שחלות בו. */
export function commitmentsFor(templates = [], month) {
  // חודש הסיום אינו חלק מהקצב, ולכן הוא נבדק בנפרד: בלעדיו חיוב
  // שנגמר ממשיך להיספר כהתחייבות לנצח
  const live = templates.filter((template) =>
    template.active
    && template.category !== 'income'
    && runsInMonth(template, month)
    && !isEnded(template, month))
  return {
    amount: sum(live.map((template) => template.actualAmount)),
    items: live.map((template) => ({
      id: template.id, name: template.name, amount: Number(template.actualAmount) || 0,
    })),
  }
}

/**
 * תשלומים שעוד לפנינו, מתוך ההערות של הרשומות שיובאו.
 * "תשלום 1 מתוך 3" אומר שנותרו שניים, ולכן הם התחייבות ידועה בדיוק
 * כמו שכירות, רק לזמן קצוב.
 */
export function futureInstallments(entries = []) {
  const months = new Map()
  const seen = new Map()

  for (const entry of entries) {
    const installment = parseInstallment(entry.note)
    if (!installment || !(entry.actualAmount > 0)) continue
    // אותה עסקה מופיעה בכל חודש שירדה בו, והמתקדם ביותר הוא הקובע
    const key = `${entry.name}|${installment.total}`
    const known = seen.get(key)
    if (!known || installment.index > known.installment.index) {
      seen.set(key, { entry, installment })
    }
  }

  for (const { entry, installment } of seen.values()) {
    for (let step = 1; step <= installment.total - installment.index; step += 1) {
      const month = shiftMonth(entry.month, step)
      months.set(month, (months.get(month) || 0) + entry.actualAmount)
    }
  }
  return months
}

/**
 * הקו קדימה.
 *
 * לכל חודש: מה נכנס בוודאות, מה יוצא בוודאות, ומה נשאר אחרי הוצאה
 * רגילה. ההתחייבויות שנגמרות מסומנות, כי הן הסיבה שהקו עולה, וזה
 * בדיוק מה שאי אפשר לראות בלי להסתכל קדימה.
 */
export function buildCapacity({
  entries = [], templates = [], now = monthKey(), months = MONTHS_AHEAD,
} = {}) {
  const typical = typicalVariable(entries, { now })
  const installments = futureInstallments(entries)

  const line = []
  for (let step = 0; step < months; step += 1) {
    const month = shiftMonth(now, step)
    const income = incomeFloor(entries, templates, month, { now })
    const commitments = commitmentsFor(templates, month)
    const due = installments.get(month) || 0
    const free = income.amount - commitments.amount - due

    line.push({
      month,
      income: income.amount,
      incomeSource: income.source,
      commitments: commitments.amount,
      items: commitments.items,
      installments: due,
      free,
      available: free - typical.amount,
      // התחייבות שנגמרת החודש היא הסיבה שהחודש הבא גבוה יותר
      ending: templates
        .filter((template) => template.active && template.endMonth === month)
        .map((template) => template.name),
    })
  }

  return { line, typical }
}

/**
 * כמה זמן לוקח לממן סכום, ומה זה עולה.
 *
 * התשובה אינה כן או לא. אפליקציית תקציב שאומרת "כן" נותנת הבטחה
 * שהיא לא יכולה לקיים, כי היא לא יודעת מה יקרה. מה שהיא כן יודעת
 * הוא כמה חודשים זה ייקח בקצב הנוכחי, ומה המצב בחודש היעד.
 */
export function planFor(line = [], amount, targetMonth) {
  const goal = Number(amount) || 0
  if (goal <= 0) return null

  let running = 0
  let readyAt = ''
  for (const month of line) {
    running += Math.max(0, month.available)
    if (!readyAt && running >= goal) readyAt = month.month
  }

  const target = line.find((month) => month.month === targetMonth)
  const untilTarget = targetMonth
    ? line.filter((month) => month.month <= targetMonth)
      .reduce((total, month) => total + Math.max(0, month.available), 0)
    : 0

  return {
    goal,
    readyAt,
    // כמה צריך להפריש בחודש כדי להגיע בזמן
    perMonth: target
      ? Math.ceil(goal / Math.max(1, line.findIndex((m) => m.month === targetMonth) + 1))
      : 0,
    untilTarget,
    shortfall: targetMonth ? Math.max(0, goal - untilTarget) : 0,
    reachesTarget: targetMonth ? untilTarget >= goal : false,
  }
}

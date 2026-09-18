import { isBillingDay, runsInMonth } from './model'

/**
 * ציר הזמן של החודש הקרוב: מה יורד, מתי, ומה נכנס.
 *
 * זו לא שאלת תקציב אלא שאלת תזרים. תקציב עונה על האם אנחנו בתוך
 * התוכנית, וזה עונה על כמה כסף צריך להיות בחשבון בכל תאריך. מי
 * שמסתכל רק על "נשאר החודש" יכול להיות בתוך התוכנית ובכל זאת ליפול
 * ב-2 בחודש, כי הכסף נכנס רק ב-10.
 */

const DAYS_AHEAD = 35

/** התאריך הקרוב ביותר שבו חל היום הזה בחודש, החל מהיום. */
export function nextOccurrence(day, today = new Date()) {
  if (!isBillingDay(Number(day))) return null
  const candidate = new Date(today.getFullYear(), today.getMonth(), Number(day))
  if (candidate < startOfDay(today)) candidate.setMonth(candidate.getMonth() + 1)
  return candidate
}

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const formatDay = (date) => `${date.getDate()}.${date.getMonth() + 1}`

/**
 * בונה את האירועים הקרובים.
 *
 * חיוב האשראי הוא אירוע אחד שמאחד את כל ההוצאות שעוברות בכרטיס,
 * ולכן הוא מופיע פעם אחת בסכום המצטבר ולא שורה לכל קנייה.
 */
export function buildTimeline({
  templates = [], cardTotal = 0, billingDay, today = new Date(),
} = {}) {
  const events = []

  for (const template of templates) {
    if (!template.active || !template.dueDay) continue
    // חיוב שעובר בכרטיס כבר נכלל בחיוב האשראי, ואין לו מועד משלו
    if (template.category !== 'income' && !template.offCard) continue
    const when = nextOccurrence(template.dueDay, today)
    if (!when) continue
    // חיוב שאינו חודשי לא בהכרח חל בחודש שאליו נפל התאריך הקרוב.
    // הבדיקה מותנית בקצב כדי שתבנית חודשית תישאר כפי שהייתה, גם
    // כשאין לה חודש פתיחה
    if (Number(template.everyMonths) > 1 && !runsInMonth(template, monthKey(when))) continue
    events.push({
      id: template.id,
      name: template.name,
      when,
      amount: template.category === 'income'
        ? Number(template.actualAmount) || 0
        : -(Number(template.actualAmount) || 0),
    })
  }

  if (cardTotal > 0 && isBillingDay(Number(billingDay))) {
    const when = nextOccurrence(billingDay, today)
    if (when) {
      events.push({ id: 'card', name: 'חיוב האשראי', when, amount: -cardTotal, card: true })
    }
  }

  const limit = new Date(startOfDay(today))
  limit.setDate(limit.getDate() + DAYS_AHEAD)

  return events
    .filter((event) => event.when <= limit)
    .sort((a, b) => a.when - b.when)
}

/**
 * כמה צריך להיות בחשבון עכשיו כדי לעבור את כל האירועים.
 *
 * הנקודה הנמוכה ביותר בציר, ולא הסכום הכולל: הכנסה שנכנסת באמצע
 * מכסה את מה שאחריה, ולכן מה שקובע הוא הרגע הקשה ביותר בדרך.
 */
export function peakRequirement(events = []) {
  let running = 0
  let lowest = 0
  let at = null

  for (const event of events) {
    running += event.amount
    if (running < lowest) {
      lowest = running
      at = event
    }
  }

  return { needed: Math.max(0, -lowest), at }
}

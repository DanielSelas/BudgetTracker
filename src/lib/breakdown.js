import { merchantSector } from './merchants'
import { BUDGET_GROUP_RATIOS } from './model'

/**
 * על מה יצא הכסף החודש, לפי ענף.
 *
 * הענף נגזר משם בית העסק בזמן קריאה ולא נשמר על השורה, ולכן זה
 * עובד גם על חודשים שכבר במסד. ההתאמה היא הכלה ולא שוויון, ולכן
 * גם שורה שהוקלדה ביד נתפסת: "מסעדות ובילויים" מכיל "מסעד".
 *
 * מה שנולד מתבנית של חיוב קבוע יוצא מהחישוב. שכר דירה וחשבונות
 * אינם בחירה שנעשתה החודש, והם היו מציפים כל פילוח ומסתירים את
 * מה שכן הוחלט.
 */
export const OTHER = 'אחר'

/** הסף שממנו ענף נחשב הרבה: שליש מהיעד של ההוצאות המשתנות. */
export const HEADLINE_SHARE = 1 / 3

const SPENDING = new Set(['fixed', 'leisure', 'unplanned'])

/** הרשומות שהפילוח מתייחס אליהן: הוצאה שנבחרה, ולא חיוב שפשוט ירד. */
export function chosenSpending(entries = []) {
  return entries.filter((entry) =>
    !entry.recurringId
    && SPENDING.has(entry.category)
    && (entry.actualAmount || 0) > 0,
  )
}

/** סכום לפי ענף, מהגדול לקטן. מה שלא מזוהה נאסף ל"אחר". */
export function monthBreakdown(entries = []) {
  const totals = new Map()
  let total = 0

  for (const entry of chosenSpending(entries)) {
    const sector = merchantSector(entry.name) || OTHER
    const amount = entry.actualAmount || 0
    totals.set(sector, (totals.get(sector) || 0) + amount)
    total += amount
  }

  const slices = [...totals.entries()]
    .map(([sector, amount]) => ({
      sector,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    // "אחר" אחרון תמיד, גם כשהוא גדול: הוא לא ענף אלא שארית
    .sort((a, b) =>
      (a.sector === OTHER) - (b.sector === OTHER) || b.amount - a.amount)

  return { slices, total }
}

/**
 * המשפט שבראש, או כלום.
 *
 * נמדד מול היעד של ההוצאות המשתנות ולא מול מה שיצא בפועל. אילו
 * המכנה היה ההוצאה בפועל, ככל שהחודש שקט יותר כך האזהרה הייתה
 * חזקה יותר: 400 מתוך 500 הם 80%, ואין בהם שום דבר חריג.
 *
 * ונבדק רק על הוצאות משתנות. סופר הוא ענף גדול בכל חודש, והוא
 * אינו בחירה שמעניין להצביע עליה.
 */
export function headlineSector(entries = [], baseAmount = 0) {
  const target = baseAmount * BUDGET_GROUP_RATIOS.leisure
  if (target <= 0) return null

  const totals = new Map()
  for (const entry of chosenSpending(entries)) {
    if (entry.category !== 'leisure') continue
    const sector = merchantSector(entry.name)
    if (!sector) continue
    totals.set(sector, (totals.get(sector) || 0) + (entry.actualAmount || 0))
  }

  const [top] = [...totals.entries()].sort((a, b) => b[1] - a[1])
  if (!top) return null

  const [sector, amount] = top
  const share = amount / target
  if (share < HEADLINE_SHARE) return null

  return { sector, amount, share, target }
}

/**
 * הצבע של ענף, כטוקן.
 *
 * חמש משפחות, גוון למשפחה, ובתוך המשפחה הבדל בבהירות. ההחלטה
 * מוסברת ב-index.css ליד הטוקנים: אחד עשר גוונים נפרדים אינם
 * ניתנים להפרדה בעין, וחמש משפחות גם אומרות משהו נכון על הכסף.
 *
 * הצבע קבוע לענף ולא נגזר מהדירוג. אחרת אותו ענף היה מחליף צבע
 * מחודש לחודש, וההשוואה בין שני חודשים הייתה נשברת.
 */
const SECTOR_COLORS = {
  'מסעדות ובתי קפה': 'food-1',
  'מזון ומשקאות': 'food-2',
  'מזון מהיר': 'food-3',
  'דלק ואנרגיה': 'move-1',
  תחבורה: 'move-2',
  חניה: 'move-3',
  'ביגוד והנעלה': 'body-1',
  'טיפוח ויופי': 'body-2',
  'בריאות ותרופות': 'life-1',
  'ריהוט ולבית': 'life-2',
  'פנאי ובידור': 'play-1',
}

export function sectorColor(sector) {
  const token = SECTOR_COLORS[sector]
  // "אחר" וכל ענף שיתווסף בלי צבע נופלים לנייטרלי, שלא מתחזה לענף
  return token ? `var(--sec-${token})` : 'var(--color-neutral-500)'
}

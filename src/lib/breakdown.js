import { merchantSector } from './merchants'
import { BUDGET_GROUP_RATIOS } from './model'

/**
 * על מה יצא הכסף החודש, לפי ענף.
 *
 * הענף נגזר משם בית העסק בזמן קריאה ולא נשמר על השורה, ולכן זה
 * עובד גם על חודשים שכבר במסד. ההתאמה היא הכלה ולא שוויון, ולכן
 * גם שורה שהוקלדה ביד נתפסת: "מסעדות ובילויים" מכיל "מסעד".
 *
 * קבועות יוצאות מהחישוב, וגם מה שנולד מתבנית. שכר דירה, חשבונות
 * וביטוח אינם בחירה שנעשתה החודש, והם היו מציפים כל פילוח ומסתירים
 * את מה שכן הוחלט. הסיווג של המשתמש הוא הקובע ולא רק קיום תבנית:
 * שורה שהוקלדה ביד וסומנה "קבועות" היא עדיין קבועה.
 */
export const OTHER = 'אחר'

/** הסף שממנו ענף נחשב הרבה: שליש מהיעד של ההוצאות המשתנות. */
export const HEADLINE_SHARE = 1 / 3

// משתנות ובלת״ם. בלת״ם נשאר בפנים כי הוא כן הוצאה שקרתה החודש,
// ודווקא מעניין לראות על מה.
const SPENDING = new Set(['leisure', 'unplanned'])

/** הרשומות שהפילוח מתייחס אליהן: הוצאה שנבחרה, ולא חיוב שפשוט ירד. */
export function chosenSpending(entries = []) {
  return entries.filter((entry) =>
    !entry.recurringId
    && SPENDING.has(entry.category)
    && (entry.actualAmount || 0) > 0,
  )
}

/** כמה פלחים הטבעת מחזיקה לפני שהזנב נאסף לאחד. */
export const RING_SLICES = 8

/** שם הפלח שאוסף את הזנב בטבעת. הרשימה שמתחת עדיין מפרטת אותו. */
export const REST = 'שאר'

/**
 * השם שהשורה תופיע תחתיו.
 *
 * ענף מוכר קודם. אחרת מה שהמשתמש כתב: קודם מפתח הקיבוץ, שהוא מה
 * שמסך החודש כבר מאחד תחתיו ומציג כ"שבע קניות", ואם אין, השם עצמו.
 * שורה שהוקלדה ביד נושאת את הקטגוריה שבראש של מי שהקליד אותה,
 * ולאסוף אותה ל"אחר" זה לזרוק מידע שכבר קיים.
 */
const labelOf = (entry) =>
  merchantSector(entry.name) || entry.groupKey || entry.name || OTHER

/** המילה הראשונה, או ריק כשאין בה מספיק כדי לאחד לפיה. */
const firstWord = (label) => {
  const [word = ''] = String(label).trim().split(/[\s,./\-־]+/)
  return word.length >= 2 ? word : ''
}

/**
 * מאחד שמות שחולקים מילה ראשונה.
 *
 * "מתנה לאיתן" ו"מתנה לדוזי" הם אותו סוג הוצאה שנרשם פעמיים, ושני
 * פלחים של אחוז אינם אומרים את מה ששניהם יחד אומרים. רק מילה
 * ראשונה, ורק כששניים או יותר חולקים אותה: מילה משותפת כלשהי הייתה
 * מאחדת "אוכל בחוץ" עם "קפה בחוץ", שהם שני דברים שונים.
 *
 * ענפים מוכרים אינם משתתפים. הם כבר קובצו לפי משמעות, ולא לפי איך
 * שבמקרה נכתבו.
 */
const mergeByFirstWord = (totals) => {
  const families = new Map()
  for (const [label, row] of totals) {
    if (row.named) continue
    const word = firstWord(label)
    if (!word || word === label) continue
    families.set(word, [...(families.get(word) || []), label])
  }

  const merged = new Map(totals)
  for (const [word, labels] of families) {
    if (labels.length < 2) continue
    const amount = labels.reduce((sum, label) => sum + merged.get(label).amount, 0)
    for (const label of labels) merged.delete(label)
    merged.set(word, { amount, named: false })
  }
  return merged
}

/** סכום לפי ענף או לפי שם, מהגדול לקטן. */
export function monthBreakdown(entries = []) {
  const totals = new Map()
  let total = 0

  for (const entry of chosenSpending(entries)) {
    const label = labelOf(entry)
    const amount = entry.actualAmount || 0
    const row = totals.get(label) || { amount: 0, named: Boolean(merchantSector(entry.name)) }
    row.amount += amount
    totals.set(label, row)
    total += amount
  }

  const slices = [...mergeByFirstWord(totals).entries()]
    .map(([sector, row]) => ({
      sector,
      amount: row.amount,
      share: total > 0 ? row.amount / total : 0,
    }))
    // "אחר" אחרון תמיד: הוא לא ענף אלא שורה בלי שם בכלל
    .sort((a, b) =>
      (a.sector === OTHER) - (b.sector === OTHER) || b.amount - a.amount)

  return { slices, total }
}

/**
 * מה שהטבעת מציירת: הגדולים, ועוד פלח אחד לכל השאר.
 *
 * חמישה עשר פלחים הם לא פילוח אלא רעש, וכמה מהם יוצאים דקים מכדי
 * שאפשר יהיה לראות אותם בכלל. הזנב נאסף לפלח אחד ואינו נעלם:
 * הרשימה שמתחת לטבעת תמיד מפרטת את כולם בשמם.
 */
export function ringSlices(slices = []) {
  // פלח אחד שנאסף ל"שאר" אינו חוסך דבר, הוא רק מוחק שם
  if (slices.length <= RING_SLICES + 1) return slices
  const tail = slices.slice(RING_SLICES)
  return [
    ...slices.slice(0, RING_SLICES),
    {
      sector: REST,
      amount: tail.reduce((sum, slice) => sum + slice.amount, 0),
      share: tail.reduce((sum, slice) => sum + slice.share, 0),
    },
  ]
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

const PALETTE = Object.values(SECTOR_COLORS)

/** מספר יציב משם, כדי שאותו שם יקבל אותו צבע בכל חודש. */
const hash = (text) => {
  let value = 0
  for (const ch of String(text)) value = (value * 31 + ch.codePointAt(0)) >>> 0
  return value
}

const NEUTRAL = 'var(--color-neutral-500)'

export function sectorColor(sector) {
  const token = SECTOR_COLORS[sector]
  if (token) return `var(--sec-${token})`
  // "אחר" ו"שאר" הם ערימות ולא ענפים, ואפור אומר את זה
  if (!sector || sector === OTHER || sector === REST) return NEUTRAL
  // שם שהוקלד ביד מקבל צבע מאותה פלטה, נגזר מהשם ולא מהדירוג
  return `var(--sec-${PALETTE[hash(sector) % PALETTE.length]})`
}

/**
 * צבע לכל פלח בחודש, כך ששניים לא יקבלו את אותו צבע.
 *
 * ענף מוכר תופס את הצבע הקבוע שלו ראשון, ואחריו השמות שהוקלדו ביד
 * מקבלים את הצבע שנגזר מהשם. כששניים נופלים על אותו צבע, השני זז
 * לפנוי הבא: שני פלחים גדולים באותו גוון הם בדיוק מה שהעוגה אמורה
 * למנוע, וזה גובר על היציבות בין חודשים.
 */
export function sliceColors(slices = []) {
  const used = new Set()
  const fills = new Map()

  for (const { sector } of slices) {
    const token = SECTOR_COLORS[sector]
    if (!token) continue
    used.add(token)
    fills.set(sector, `var(--sec-${token})`)
  }

  for (const { sector } of slices) {
    if (fills.has(sector)) continue
    if (!sector || sector === OTHER || sector === REST) {
      fills.set(sector, NEUTRAL)
      continue
    }
    const start = hash(sector) % PALETTE.length
    let token = PALETTE[start]
    for (let step = 1; step <= PALETTE.length && used.has(token); step += 1) {
      token = PALETTE[(start + step) % PALETTE.length]
    }
    used.add(token)
    fills.set(sector, `var(--sec-${token})`)
  }

  return fills
}

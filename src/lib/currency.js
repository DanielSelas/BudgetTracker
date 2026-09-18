/**
 * מטבע חוץ בדוחות אשראי.
 *
 * דוח של כרטיס בנקאי מכיל גם עסקאות שחויבו בדולר ובאירו, ועמודת
 * "מטבע העסקה" נשארת ריקה. שורה של 180 שחויבה באירו הייתה נכנסת
 * כ-180 שקלים, טעות של פי ארבעה בשקט.
 *
 * מה שכן יש הוא שורת סיכום בראש הקובץ, שמפרטת את החיוב לכל מטבע
 * בנפרד. היא האמת, והניחוש לפי מדינה נבדק מולה ולא מחליף אותה.
 */

/** מטבעות שהדוח מציג בסימן ולא בקוד. */
const SYMBOLS = { '₪': 'ILS', $: 'USD', '€': 'EUR', '£': 'GBP' }

export const CURRENCY_LABEL = {
  ILS: 'שקל', USD: 'דולר', EUR: 'אירו', GBP: 'לירה שטרלינג',
}

/** מדינות גוש האירו, לפי הסיומת שחברת האשראי מוסיפה לשם בית העסק. */
const EUR_COUNTRIES = new Set([
  'NL', 'ES', 'AT', 'DE', 'FR', 'IT', 'BE', 'PT', 'IE', 'FI', 'GR',
  'SK', 'SI', 'EE', 'CY', 'MT', 'LU', 'LV', 'LT', 'HR',
])

/**
 * כל סכומי החיוב שבשורת הסיכום, לפי הסדר.
 * השורה מצטברת בין קבצים, ולכן הסדר הוא מה שמאפשר לזהות אילו
 * סכומים שייכים לקובץ שלפנינו.
 */
export function parseChargeTotals(text) {
  return [...String(text || '').matchAll(/([₪$€£])\s*(-?[\d,]+(?:\.\d+)?)/g)]
    .map((match) => ({
      currency: SYMBOLS[match[1]],
      amount: Number(match[2].replace(/,/g, '')),
    }))
    .filter((item) => item.currency && Number.isFinite(item.amount))
}

/**
 * אילו מהסכומים שייכים לקובץ הזה.
 *
 * שורת הסיכום מצטברת, ולכן היא מכילה גם חודשים קודמים. הסכומים של
 * הקובץ הנוכחי הם האחרונים, ומספרם נקבע מהצטברות מהסוף עד שהיא
 * משתווה לסכום השורות שבקובץ. זו בדיקה ולא ניחוש: אם אין התאמה,
 * מוטב לומר שאין מאשר להמציא חלוקה.
 */
export function totalsForFile(terms = [], rowTotal, tolerance = 0.02) {
  let running = 0
  for (let index = terms.length - 1; index >= 0; index -= 1) {
    running += terms[index].amount
    if (Math.abs(running - rowTotal) <= tolerance) return terms.slice(index)
  }
  return null
}

/** סיכום לפי מטבע, כי אותו מטבע יכול להופיע יותר מפעם אחת. */
export function byCurrency(terms = []) {
  const sums = new Map()
  for (const { currency, amount } of terms) {
    sums.set(currency, Math.round(((sums.get(currency) || 0) + amount) * 100) / 100)
  }
  return sums
}

/**
 * ניחוש המטבע של שורה בודדת.
 *
 * הסיומת בשם בית העסק היא הרמז היחיד, ולכן היא הבסיס. הדוח מסמן
 * במפורש עסקת חו"ל שחויבה בשקלים, וזה גובר על הסיומת.
 */
export function guessCurrency({ name, type, note, forced, gross, amount }) {
  if (forced) return forced
  if (!/חו"?ל|חו״ל/.test(String(type || ''))) return 'ILS'
  if (/בש"?ח|בש״ח/.test(String(note || ''))) return 'ILS'

  // שתי עמודות הסכום הן הראיה הישירה: סכום חיוב ששונה מסכום העסקה
  // פירושו שבוצעה המרה, כלומר החיוב יצא בשקלים. כשהם זהים לא הייתה
  // המרה, והחיוב יצא במטבע המקור. זה גובר על הסיומת בשם, שהיא
  // ניחוש: באוקטובר כל בתי העסק האמריקאיים נראו כדולרים ובפועל
  // כרטיסי הטיסה חויבו בשקלים לפי שער 3.88
  if (Number.isFinite(gross) && Number.isFinite(amount) && gross !== 0) {
    if (Math.abs(Math.abs(amount) - Math.abs(gross)) > 0.005) return 'ILS'
  }
  const country = String(name || '').trim().match(/\b([A-Z]{2})$/)?.[1]
  if (!country || country === 'IL') return 'ILS'
  if (country === 'US') return 'USD'
  if (country === 'GB') return 'GBP'
  return EUR_COUNTRIES.has(country) ? 'EUR' : ''
}

/**
 * האם הניחוש מסכים עם מה שכתוב בראש הקובץ.
 *
 * זו כל הנקודה: כשיש הסכמה אפשר להמיר בביטחון, וכשאין, הפיצול
 * שגוי ואסור להמיר לפיו. באוקטובר למשל כל העסקאות עם סיומת US
 * חויבו דווקא בשקלים, והניחוש לבדו היה מכפיל אותן פי שלושה וחצי.
 */
export function reconcile(rows = [], fileTotals, tolerance = 0.02) {
  const guessed = new Map()
  for (const row of rows) {
    const currency = guessCurrency(row) || '?'
    guessed.set(currency, Math.round(((guessed.get(currency) || 0) + row.amount) * 100) / 100)
  }

  if (!fileTotals) return { agrees: false, guessed, expected: null, reason: 'no-totals' }

  const expected = byCurrency(fileTotals)
  const currencies = new Set([...guessed.keys(), ...expected.keys()])
  for (const currency of currencies) {
    const gap = Math.abs((guessed.get(currency) || 0) - (expected.get(currency) || 0))
    if (gap > tolerance) return { agrees: false, guessed, expected, reason: 'mismatch' }
  }
  return { agrees: true, guessed, expected, reason: '' }
}

/**
 * שיוך השורות שהמטבע שלהן לא זוהה.
 *
 * מדינה שאינה ברשימה משאירה שורות בלי מטבע, ואז ההצלבה נשברת גם
 * כשכל השאר נכון. אם קיים מטבע אחד ויחיד ששיוך כל השורות האלה אליו
 * מיישב את ההצלבה במדויק, זו אינה השערה אלא הפתרון היחיד שהקובץ
 * מאפשר. יותר מאחד, או אף אחד, ומוטב לומר שאין.
 */
export function resolveUnknown(rows = [], expected, tolerance = 0.02) {
  if (!expected) return ''
  const unknown = rows.filter((row) => !guessCurrency(row))
  if (unknown.length === 0) return ''

  const candidates = [...expected.keys()]
  const fits = candidates.filter((candidate) =>
    reconcile(
      rows.map((row) => (guessCurrency(row) ? row : { ...row, forced: candidate })),
      [...expected].map(([currency, amount]) => ({ currency, amount })),
      tolerance,
    ).agrees)

  return fits.length === 1 ? fits[0] : ''
}

/** המרה לשקלים לפי שערים שהמשתמש הזין. */
export const toShekels = (amount, currency, rates = {}) =>
  currency === 'ILS' ? amount : amount * (Number(rates[currency]) || 0)

/**
 * המרת שורות הקובץ לשקלים.
 *
 * ממירים רק כשההצלבה מול שורת הסיכום הסכימה. בלי הסכמה הפיצול בין
 * המטבעות שגוי, ולכן השורות שאינן שקליות מדולגות במקום להיכנס
 * בסכום מומצא: חוסר עדיף על מספר שנראה אמין ואינו נכון.
 *
 * skipForeign מדלג עליהן תמיד. הזיהוי עדיין נחוץ כדי לדעת על אילו
 * שורות לדלג: הניחוש לבדו סימן באוקטובר את כל בתי העסק האמריקאיים
 * כדולרים, ושורת הסיכום הראתה שהם חויבו בשקלים.
 */
export function applyCurrency(rows = [], { totalsLine, rates = {}, skipForeign = false } = {}) {
  const rowTotal = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
  const totals = totalsForFile(parseChargeTotals(totalsLine), rowTotal)
  const check = reconcile(rows, totals)

  // שורה שהמטבע שלה לא זוהה יכולה להיות היחידה ששוברת את ההצלבה
  const resolved = check.agrees ? '' : resolveUnknown(rows, check.expected)
  const currencyOf = (row) => guessCurrency(row) || resolved
  const settled = resolved
    ? reconcile(rows.map((row) => ({ ...row, forced: currencyOf(row) })), totals)
    : check

  const foreign = new Map()
  for (const row of rows) {
    const currency = currencyOf(row) || '?'
    if (currency !== 'ILS') {
      foreign.set(currency, Math.round(((foreign.get(currency) || 0) + row.amount) * 100) / 100)
    }
  }

  if (foreign.size === 0) {
    return { rows, foreign, agrees: true, dropped: 0, needsRates: [] }
  }

  if (skipForeign || !settled.agrees) {
    const kept = rows.filter((row) => currencyOf(row) === 'ILS')
    return {
      rows: kept,
      foreign,
      agrees: settled.agrees,
      dropped: rows.length - kept.length,
      needsRates: [],
    }
  }

  // שער חסר אינו סיבה לדלג: בלעדיו פשוט אין עדיין מה להמיר, והמסך
  // מבקש אותו. הדילוג שמור למקרה שבו הפיצול עצמו אינו אמין
  const needsRates = [...foreign.keys()].filter((currency) => !Number(rates[currency]))

  return {
    rows: rows.map((row) => {
      const currency = currencyOf(row)
      if (currency === 'ILS') return row
      return {
        ...row,
        currency,
        original: row.amount,
        amount: Math.round(toShekels(row.amount, currency, rates) * 100) / 100,
      }
    }),
    foreign,
    agrees: true,
    dropped: 0,
    needsRates,
  }
}

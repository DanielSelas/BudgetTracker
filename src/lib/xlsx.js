/**
 * קורא xlsx מינימלי.
 *
 * הספרייה המקובלת לקריאת xlsx נעצרה ב-npm בגרסה ישנה שאינה מתוחזקת
 * ויש בה פגיעויות ידועות, ולא הייתי מכניס אותה לפרויקט שמחזיק נתונים
 * פיננסיים. קובץ xlsx הוא ZIP של XML, ולכן פריקה עם ספרייה זעירה
 * ופענוח של שני קבצים מספיקים למה שצריך כאן: גיליון אחד של טבלה.
 *
 * מה שלא נתמך בכוונה: נוסחאות מחושבות, כמה גיליונות, ותאים ממוזגים.
 * ייצוא של בנק או של חברת אשראי הוא טבלה שטוחה, ולא גיליון עבודה.
 */

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57, 58])

const text = (bytes) => new TextDecoder('utf-8').decode(bytes)
const parseXml = (source) => new DOMParser().parseFromString(source, 'application/xml')

/**
 * חיפוש תגית בלי קשר למרחב השמות.
 *
 * חלק מהמייצאים כותבים <row> וחלק כותבים <x:row>, ושניהם תקינים.
 * חיפוש לפי שם התגית המלא מוצא רק אחד מהם, ולכן קובץ אמיתי מחברת
 * אשראי נקרא כריק בלי שום שגיאה.
 */
const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)]

/** מספר סידורי של אקסל אל YYYY-MM-DD. הבסיס הוא 30.12.1899. */
export function serialToDate(serial) {
  const days = Math.floor(Number(serial))
  if (!Number.isFinite(days) || days < 1) return ''
  const date = new Date(Date.UTC(1899, 11, 30 + days))
  return date.toISOString().slice(0, 10)
}

/** עמודה מתוך אסמכתה כמו "BC12", כאינדקס מאפס. */
export function columnIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/)?.[0] || 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

const cellText = (node) =>
  // טקסט עשיר מפוצל לכמה רצפים, וכולם יחד הם הערך
  tags(node, 't').map((item) => item.textContent).join('')

/** אילו אינדקסים של סגנון מייצגים תאריך. */
function dateStyles(stylesXml) {
  if (!stylesXml) return new Set()
  const doc = parseXml(stylesXml)

  const custom = new Map()
  for (const format of tags(doc, 'numFmt')) {
    const id = Number(format.getAttribute('numFmtId'))
    const code = format.getAttribute('formatCode') || ''
    // קוד תאריך מכיל y, m או d מחוץ למחרוזות. הסרת המחרוזות קודם
    // מונעת זיהוי שגוי של טקסט כמו "day"
    custom.set(id, /[ymd]/i.test(code.replace(/"[^"]*"/g, '')))
  }

  const styles = new Set()
  const cellXfs = tags(doc, 'cellXfs')[0]
  if (!cellXfs) return styles
  tags(cellXfs, 'xf').forEach((xf, index) => {
    const id = Number(xf.getAttribute('numFmtId') || 0)
    if (BUILTIN_DATE_FORMATS.has(id) || custom.get(id)) styles.add(index)
  })
  return styles
}

/**
 * המטבע של כל סגנון תא, מתוך קוד עיצוב המספר.
 *
 * זו האמת ולא השערה: דוח שמחייב בכמה מטבעות מגדיר פורמט לכל אחד
 * מהם, כמו "$"#,##0.00 לצד "₪"#,##0.00, וכל תא מצביע על הפורמט
 * שלו. עד שקראנו את זה, המטבע שוחזר מסיומת שם בית העסק.
 */
const SYMBOL_CURRENCY = { '₪': 'ILS', $: 'USD', '€': 'EUR', '£': 'GBP' }

export function currencyStyles(source) {
  const byStyle = new Map()
  if (!source) return byStyle

  const doc = parseXml(source)
  const custom = new Map()
  for (const format of tags(doc, 'numFmt')) {
    const id = Number(format.getAttribute('numFmtId'))
    const code = format.getAttribute('formatCode') || ''
    // הסימן יושב בתוך מרכאות או בסוגריים מרובעים, לפי הכלי שייצא
    const symbol = Object.keys(SYMBOL_CURRENCY).find((sign) => code.includes(sign))
    if (symbol) custom.set(id, SYMBOL_CURRENCY[symbol])
  }
  if (custom.size === 0) return byStyle

  const cellXfs = tags(doc, 'cellXfs')[0]
  if (!cellXfs) return byStyle
  tags(cellXfs, 'xf').forEach((xf, index) => {
    const currency = custom.get(Number(xf.getAttribute('numFmtId') || 0))
    if (currency) byStyle.set(index, currency)
  })
  return byStyle
}

/**
 * שורות הגיליון הראשון, כמערך מערכים של מחרוזות, באותו מבנה שמחזיר
 * פענוח CSV. כך שאר הזרימה אינה יודעת מאיזה סוג קובץ הגיע המידע.
 *
 * לצדן מוחזר מבנה מקביל עם המטבע של כל תא, כשעיצוב המספר מציין
 * אותו. בדוח שמחייב בכמה מטבעות זה הנתון היחיד שאומר בוודאות מה
 * ירד בפועל.
 */
export async function readXlsx(file) {
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))

  const sheetName = Object.keys(zip)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()[0]
  if (!sheetName) throw new Error('לא נמצא גיליון בקובץ')

  const shared = zip['xl/sharedStrings.xml']
    ? tags(parseXml(text(zip['xl/sharedStrings.xml'])), 'si').map(cellText)
    : []
  const styleXml = zip['xl/styles.xml'] ? text(zip['xl/styles.xml']) : null
  const styles = dateStyles(styleXml)
  const currencies = currencyStyles(styleXml)

  const sheet = parseXml(text(zip[sheetName]))
  const rows = []
  // מטבע לכל תא, במבנה מקביל לשורות, כדי ששאר הזרימה תמשיך לקבל
  // מערך מחרוזות פשוט כמו מ-CSV
  const cellCurrency = []

  for (const row of tags(sheet, 'row')) {
    const cells = []
    const marks = []
    for (const cell of tags(row, 'c')) {
      const at = columnIndex(cell.getAttribute('r') || 'A')
      const type = cell.getAttribute('t')
      const style = Number(cell.getAttribute('s') || -1)
      const value = tags(cell, 'v')[0]?.textContent ?? ''

      let out = ''
      // תא ריק נכתב לפעמים כ-t="s" בלי ערך, ו-Number('') הוא אפס,
      // ולכן בלי הבדיקה הזו כל תא ריק מקבל את המחרוזת הראשונה בקובץ
      if (type === 'inlineStr') out = cellText(cell)
      else if (value === '') out = ''
      else if (type === 's') out = shared[Number(value)] ?? ''
      else out = styles.has(style) ? serialToDate(value) : value

      while (cells.length < at) cells.push('')
      // כותרות מרובות שורות נפוצות בייצוא, והרווח הלבן רק מפריע
      cells[at] = String(out).replace(/\s+/g, ' ').trim()
      marks[at] = currencies.get(style) || ''
    }
    rows.push(cells)
    cellCurrency.push(marks)
  }

  // שתי הרשימות מסוננות יחד, אחרת המטבעות מתפרקים מהשורות שלהם
  const keep = rows.map((row) => row.some((cell) => cell))
  return {
    rows: rows.filter((_, index) => keep[index]),
    currencies: cellCurrency.filter((_, index) => keep[index]),
  }
}

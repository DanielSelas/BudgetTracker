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

const cellText = (node) => {
  // טקסט עשיר מפוצל לכמה רצפים, וכולם יחד הם הערך
  const parts = [...node.getElementsByTagName('t')].map((item) => item.textContent)
  return parts.join('')
}

/** אילו אינדקסים של סגנון מייצגים תאריך. */
function dateStyles(stylesXml) {
  if (!stylesXml) return new Set()
  const doc = parseXml(stylesXml)

  const custom = new Map()
  for (const format of doc.getElementsByTagName('numFmt')) {
    const id = Number(format.getAttribute('numFmtId'))
    const code = format.getAttribute('formatCode') || ''
    // קוד תאריך מכיל y, m או d מחוץ למחרוזות. הסרת המחרוזות קודם
    // מונעת זיהוי שגוי של טקסט כמו "day"
    custom.set(id, /[ymd]/i.test(code.replace(/"[^"]*"/g, '')))
  }

  const styles = new Set()
  const cellXfs = doc.getElementsByTagName('cellXfs')[0]
  if (!cellXfs) return styles
  ;[...cellXfs.getElementsByTagName('xf')].forEach((xf, index) => {
    const id = Number(xf.getAttribute('numFmtId') || 0)
    if (BUILTIN_DATE_FORMATS.has(id) || custom.get(id)) styles.add(index)
  })
  return styles
}

/**
 * שורות הגיליון הראשון, כמערך מערכים של מחרוזות, באותו מבנה שמחזיר
 * פענוח CSV. כך שאר הזרימה אינה יודעת מאיזה סוג קובץ הגיע המידע.
 */
export async function readXlsx(file) {
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))

  const sheetName = Object.keys(zip)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()[0]
  if (!sheetName) throw new Error('לא נמצא גיליון בקובץ')

  const shared = zip['xl/sharedStrings.xml']
    ? [...parseXml(text(zip['xl/sharedStrings.xml'])).getElementsByTagName('si')].map(cellText)
    : []
  const styles = dateStyles(zip['xl/styles.xml'] ? text(zip['xl/styles.xml']) : null)

  const sheet = parseXml(text(zip[sheetName]))
  const rows = []

  for (const row of sheet.getElementsByTagName('row')) {
    const cells = []
    for (const cell of row.getElementsByTagName('c')) {
      const at = columnIndex(cell.getAttribute('r') || 'A')
      const type = cell.getAttribute('t')
      const style = Number(cell.getAttribute('s') || -1)
      const value = cell.getElementsByTagName('v')[0]?.textContent ?? ''

      let out = ''
      if (type === 's') out = shared[Number(value)] ?? ''
      else if (type === 'inlineStr') out = cellText(cell)
      else if (value !== '') out = styles.has(style) ? serialToDate(value) : value

      while (cells.length < at) cells.push('')
      cells[at] = String(out).trim()
    }
    rows.push(cells)
  }

  return rows.filter((row) => row.some((cell) => cell))
}

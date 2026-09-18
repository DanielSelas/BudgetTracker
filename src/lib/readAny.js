import { parseCsv, readText } from './csv'

/**
 * קריאת קובץ לפי מה שהוא באמת, ולא לפי הסיומת שלו.
 *
 * ייצוא מבנקים ומחברות אשראי בישראל מגיע לעיתים קרובות עם סיומת
 * מטעה: קובץ שנקרא xlsx ובפועל הוא טבלת HTML, או להפך. זיהוי לפי
 * הסיומת נכשל בדיוק על הקבצים שהכי חשוב שיעבדו.
 */

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const OLD_EXCEL = [0xd0, 0xcf, 0x11, 0xe0]

const startsWith = (bytes, signature) =>
  signature.every((byte, index) => bytes[index] === byte)

/** מה הקובץ, לפי ארבעת הבתים הראשונים ולפי התוכן. */
export async function sniff(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (startsWith(head, ZIP)) return 'xlsx'
  if (startsWith(head, OLD_EXCEL)) return 'xls'

  const sample = (await readText(file.slice(0, 4096))).toLowerCase()
  if (sample.includes('<table') || sample.includes('<html')) return 'html'
  return 'csv'
}

/** שורות מכל פורמט נתמך, באותו מבנה של מערך מערכים. */
export async function readAnyFile(file) {
  const kind = await sniff(file)

  if (kind === 'xlsx') {
    const { readXlsx } = await import('./xlsx')
    return { kind, ...(await readXlsx(file)) }
  }

  if (kind === 'html') {
    const { readHtmlTable } = await import('./htmlTable')
    return { kind, rows: readHtmlTable(await readText(file)) }
  }

  if (kind === 'xls') {
    // פורמט בינארי ישן. פענוח שלו הוא פרויקט בפני עצמו, ולשמור על
    // הקובץ בפורמט אחר לוקח למשתמש חצי דקה
    throw new Error('זה קובץ Excel בפורמט ישן. פתחו אותו ושמרו כ-CSV או כ-XLSX')
  }

  return { kind, rows: parseCsv(await readText(file)) }
}

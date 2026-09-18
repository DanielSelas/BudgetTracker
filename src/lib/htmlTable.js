/**
 * טבלת HTML כמקור נתונים.
 *
 * חלק מהבנקים מייצאים קובץ שנקרא xls או xlsx ובתוכו טבלת HTML. זה
 * נפתח באקסל ולכן נראה תקין למשתמש, ולכן גם אין סיבה לדרוש ממנו
 * להמיר אותו בעצמו.
 */

/** הטבלה עם הכי הרבה שורות, כי קבצים כאלה עוטפים בטבלאות פריסה. */
export function readHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = [...doc.getElementsByTagName('table')]
  if (tables.length === 0) return []

  const best = tables.reduce((winner, table) =>
    table.rows.length > winner.rows.length ? table : winner)

  return [...best.rows]
    .map((row) => [...row.cells].map((cell) =>
      cell.textContent.replace(/ /g, ' ').trim()))
    .filter((row) => row.some((cell) => cell))
}

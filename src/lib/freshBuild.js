/**
 * התאוששות מגרסה תקועה.
 *
 * האפליקציה מותקנת כ-PWA, ולכן דף שנטען לפני פריסה חדשה ממשיך לחיות
 * אחריה. הוא מצביע על קבצי JavaScript שכבר נמחקו מהשרת, ומכיוון
 * שווסל מחזירה את index.html לכל נתיב לא קיים, הדפדפן מקבל HTML
 * במקום קוד ונופל על "text/html is not a valid JavaScript MIME type".
 *
 * זה קורה רק בטעינה עצלה, ולכן הוא לא מתגלה בפתיחה אלא ברגע שלוחצים
 * על משהו. אצלנו זה היה מסך הייבוא, שטוען את קורא ה-xlsx לפי צורך.
 *
 * הפתרון הוא טעינה מחדש: היא מביאה index.html עדכני ואיתו את הקבצים
 * שבאמת קיימים. שמירה של רגע הטעינה מונעת לולאה, כי אם גם הגרסה
 * החדשה נכשלת אין טעם לנסות שוב ושוב.
 */

const KEY = 'bt:recovered-at'
const QUIET_MS = 30000

export function recoverOnce(now = Date.now()) {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (now - last < QUIET_MS) return false
    sessionStorage.setItem(KEY, String(now))
  } catch {
    // גלישה פרטית חוסמת אחסון. עדיף לטעון מחדש פעם אחת מלא לנסות
  }
  return true
}

export function watchForStaleBuild(target = window) {
  // vite שולח את האירוע הזה כשטעינה עצלה של קובץ נכשלה
  target.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.()
    if (recoverOnce()) target.location.reload()
  })
}

/** האם הכישלון הוא גרסה תקועה ולא קובץ פגום. */
export const isStaleBuildError = (error) =>
  /MIME type|Failed to fetch dynamically imported|Importing a module script failed/i
    .test(String(error?.message || ''))

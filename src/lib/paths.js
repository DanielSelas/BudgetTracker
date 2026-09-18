import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * המקום היחיד בקוד שיודע איפה רשומות חיות.
 *
 * הן היו באוסף אחד ברמה העליונה, עם שדה budgetId שסינן אותן. זה עבד,
 * אבל בקונסולה זה נראה כמו ערימה אחת של מזהים אקראיים בלי שום דרך
 * לדעת למי הם שייכים, ובכללי האבטחה זה חייב לוודא בכל כתיבה שהרשומה
 * לא מוברחת לתקציב אחר.
 *
 * עכשיו הן תת אוסף של התקציב. התקציב נמצא בנתיב, ולכן הוא לא שדה
 * ואי אפשר לסתור אותו.
 */

export const entriesRef = (budgetId) => collection(db, 'budgets', budgetId, 'entries')

export const entryRef = (budgetId, entryId) =>
  doc(db, 'budgets', budgetId, 'entries', entryId)

const MAX_SLUG = 40

/**
 * מזהה קריא לרשומה חדשה, במקום המחרוזת האקראית ש-addDoc מייצר.
 * החודש והקטגוריה בהתחלה, כך שהקונסולה ממוינת בעצמה לפי זמן.
 *
 * הזנב האקראי אינו קישוט: שתי קניות באותו שם ובאותו חודש הן שתי
 * רשומות אמיתיות, ובלעדיו השנייה הייתה דורסת את הראשונה.
 */
export function entryId({ month, category, name }) {
  const slug = (name || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, MAX_SLUG)
  const tail = Math.random().toString(36).slice(2, 8)
  return [month, category, slug, tail].filter(Boolean).join('_')
}

/**
 * מזהה קריא לתקציב חדש: סוג, שם, וזנב קצר.
 *
 * בקונסולה של Firebase רואים רשימת מסמכים ותו לא, ולכן מזהה אקראי
 * פירושו להיכנס לכל אחד כדי לדעת מה הוא. עם הסוג בהתחלה הרשימה
 * ממוינת מאליה, ורואים מיד מה יש.
 *
 * מזהה של מסמך אינו ניתן לשינוי, ולכן הוא משקף את השם בזמן היצירה.
 * שינוי שם התקציב אחר כך לא יזיז אותו, וזה בסדר: המזהה הוא לזיהוי
 * ולא לתצוגה.
 */
export function budgetId({ type, name }) {
  const slug = (name || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, MAX_SLUG)
  const tail = Math.random().toString(36).slice(2, 8)
  return [type || 'household', slug, tail].filter(Boolean).join('_')
}

/** אותו רעיון לתבנית של חיוב קבוע, שממנה נגזר גם מזהה השורה החודשית. */
export function recurringId({ category, name }) {
  const slug = (name || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, MAX_SLUG)
  // בלי זנב אקראי, ובכוונה. שתי קניות באותו שם הן שתי עסקאות
  // אמיתיות, אבל "שכר דירה" שנוצר פעמיים הוא אותה התחייבות: לחיצה
  // שנייה על שמירה צריכה לדרוס ולא להוסיף. זנב אקראי כאן יצר שלוש
  // תבניות לשכר דירה אחד, ואיתן שלוש שורות בכל חודש
  return [category, slug].filter(Boolean).join('-')
}

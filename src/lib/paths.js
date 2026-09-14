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

/** האוסף הישן. קיים רק בשביל המיגרציה, ונמחק אחריה. */
export const legacyEntriesRef = () => collection(db, 'entries')

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
 * מזהים שנגזרים מתוכן, כמו שורה של חיוב קבוע או שורה מסכמת של טיול,
 * הם מפתח האידמפוטנטיות של המערכת. מיגרציה חייבת לשמר אותם בדיוק,
 * אחרת אותה שורה תיווצר שוב בכניסה הבאה למסך.
 */
export const isDerivedId = (id) => id.includes('__')

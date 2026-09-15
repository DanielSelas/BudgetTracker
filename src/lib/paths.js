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

/**
 * זנב יציב שנגזר ממחרוזת, ולא אקראי.
 *
 * זה ההבדל בין רשומה חדשה למיגרציה. בהזנה חדשה הזנב חייב להיות
 * אקראי, כי שתי קניות זהות באותו חודש הן שתי רשומות. בהעתקה הוא
 * חייב להיות יציב, אחרת כל הרצה חוזרת מייצרת מזהים חדשים ומשכפלת
 * את הכל במקום לכתוב מעל. בדיוק זה קרה.
 */
export function stableTail(seed) {
  let hash = 0x811c9dc5
  for (let index = 0; index < String(seed).length; index += 1) {
    hash ^= String(seed).charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

/** שם קריא לרשומה מועתקת, יציב לחלוטין מול מזהה המקור. */
export function migratedEntryId({ month, category, name, id }) {
  return entryId({ month, category, name }).replace(/_[^_]*$/, `_${stableTail(id)}`)
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
  const tail = Math.random().toString(36).slice(2, 8)
  return [category, slug, tail].filter(Boolean).join('-')
}

import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { entryRef, entryId } from './paths'
import { stableTail } from './importEntries'
import { CATEGORIES, monthOfDate, todayDate } from './model'
import { MAX_GROUP_LENGTH, normalizeGroup } from './groups'
import { parseCapture } from './capture'

/**
 * תיבת ההוצאות הממתינות.
 *
 * הפער בין "להזין הוצאה" לבין "לאשר הוצאה" הוא הפער בין מאמץ לבין
 * אישור, וזה כל הרעיון: מי שלא מזין כלום כן מאשר. לכן מה שנקלט לא
 * נכנס לתקציב מעצמו אלא ממתין, עם ניחוש של קטגוריה.
 *
 * זה אוסף נפרד מהרשומות ולא דגל עליהן, כי רשומה ממתינה אינה רשומה:
 * היא לא נספרת בסיכום, לא נכנסת ליעדים ולא מלמדת כלום. דגל היה
 * מחייב כל חישוב באפליקציה לזכור לסנן אותה, ושכחה אחת מזהמת הכל.
 */

export const inboxRef = (budgetId) => collection(db, 'budgets', budgetId, 'inbox')

export const inboxItemRef = (budgetId, itemId) =>
  doc(db, 'budgets', budgetId, 'inbox', itemId)

const slug = (text) =>
  String(text || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24)

/**
 * מזהה שנגזר מהתוכן, ולא אקראי.
 *
 * הסיבה כאן אינה ייבוא חוזר אלא הקישור: הקיצור פותח את האפליקציה עם
 * ההוצאה בכתובת, ולכן רענון של אותו עמוד היה מוסיף אותה שוב. גם
 * נקישה כפולה על גב הטלפון היא אותו מקרה. הכתובת מתנקה אחרי
 * הקריאה, וזה הגיבוי לכך.
 *
 * המחיר: שתי קניות זהות באותו יום, באותו סכום ובאותו מקום, נספרות
 * כאחת. זה מקרה נדיר יותר מרענון, והוא גם נראה מיד.
 */
export function captureId({ date, name, amount }) {
  return `cap_${date}_${slug(name)}_${stableTail(`${date}|${amount}|${name}`)}`
}

/**
 * כתיבת הוצאה שנקלטה. מקבלת גם טקסט חופשי וגם סכום ושם מופרדים,
 * כי קיצור יכול לשלוח כך או כך.
 */
export function addCapture({
  budgetId, uid, text = '', name = '', amount = 0,
  date = todayDate(), source = 'shortcut', suggestion = {},
}) {
  const parsed = text ? parseCapture(text) : { amount: 0, name: '' }
  const finalAmount = Number(amount) || parsed.amount
  const finalName = String(name || parsed.name || '').trim().slice(0, 100)

  if (!finalAmount || finalAmount <= 0) return Promise.reject(new Error('no-amount'))
  // שם ריק אינו תקלה של המשתמש אלא קליטה חלקית, ולכן יש ברירת מחדל
  // ולא סירוב: הסכום הוא מה שקשה לשחזר אחר כך, והשם אפשר לתקן
  const label = finalName || 'הוצאה'
  const groupKey = normalizeGroup(String(suggestion.groupKey || '').slice(0, MAX_GROUP_LENGTH))

  return setDoc(
    inboxItemRef(budgetId, captureId({ date, name: label, amount: finalAmount })),
    {
      name: label,
      amount: finalAmount,
      date,
      source: source === 'manual' ? 'manual' : 'shortcut',
      createdBy: uid,
      ...(suggestion.category ? { suggestedCategory: suggestion.category } : {}),
      ...(groupKey ? { groupKey } : {}),
    },
  )
}

export function watchInbox(budgetId, onItems, onError) {
  return onSnapshot(
    query(inboxRef(budgetId)),
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      // הישן למעלה: מה שממתין יותר זמן הוא מה שכדאי לסגור קודם
      items.sort((a, b) => String(a.date).localeCompare(String(b.date)))
      onItems(items)
    },
    onError,
  )
}

/**
 * אישור: הרשומה נכתבת והשורה הממתינה נמחקת, בכתיבה אטומית אחת.
 *
 * בלי זה היו שני מצבי כשל אמיתיים: רשומה שנכתבה והשורה נשארה
 * ממתינה, כלומר הוצאה שתאושר פעמיים, או שורה שנמחקה בלי שנכתב
 * כלום, כלומר הוצאה שנעלמה.
 *
 * החודש נגזר מתאריך ההוצאה ולא מהחודש שפתוח על המסך: אישור ב-2
 * בחודש של קנייה מה-30 שייך לחודש שבו היא קרתה.
 */
export function approveCapture({ budgetId, uid, item, category, groupKey }) {
  const month = monthOfDate(item.date)
  // מחרוזת ריקה אינה "לא נאמר" אלא "בפני עצמה". רק היעדר ערך נופל
  // חזרה לקבוצה שנוחשה, אחרת ניתוק מקבוצה היה מתעלם מעצמו
  const group = normalizeGroup(groupKey === undefined ? (item.groupKey || '') : groupKey)
  const batch = writeBatch(db)

  batch.set(entryRef(budgetId, entryId({ month, category, name: item.name })), {
    month,
    date: item.date,
    category,
    budgetGroup: CATEGORIES[category].budgetGroup,
    name: item.name,
    plannedAmount: 0,
    actualAmount: item.amount,
    addedBy: uid,
    addedAt: serverTimestamp(),
    ...(group ? { groupKey: group } : {}),
    ...(item.note ? { note: String(item.note).slice(0, 200) } : {}),
  })
  batch.delete(inboxItemRef(budgetId, item.id))

  return batch.commit()
}

export const dismissCapture = (budgetId, itemId) =>
  deleteDoc(inboxItemRef(budgetId, itemId))

/**
 * פרמטרים בכתובת שפותחים את האפליקציה במצב מסוים.
 *
 * כולם נקראים פעם אחת בעליית האפליקציה ואז מנוקים מהכתובת, כדי
 * שרענון לא יחזור על אותה פעולה. הקריאה נעשית לפני כל ניקוי ולא
 * בכל רכיב בנפרד, אחרת הניקוי של הראשון היה מוחק את הפרמטר של השני.
 */

const params = () => new URLSearchParams(window.location.search)

/** קישור מתוך התראת סוף החודש: /?nudge=fund&budget=<id>&amount=<x> */
export function readNudge() {
  if (typeof window === 'undefined') return null
  const search = params()
  if (search.get('nudge') !== 'fund') return null

  const budgetId = search.get('budget')
  const amount = Number(search.get('amount'))
  return {
    budgetId: budgetId || null,
    category: 'fund',
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
  }
}

/**
 * קליטה מהירה מקיצור של iOS: /?add=50 סופר
 *
 * זו הסיבה שאין כאן שרת ואין אסימון: הדפדפן כבר מחובר, ולכן הקיצור
 * רק פותח כתובת והאפליקציה כותבת בעצמה בהרשאות של המשתמש. אין מה
 * לדלוף ואין מה לתחזק.
 *
 * אפשר גם סכום ושם מופרדים, לקיצור שמעדיף לשאול שתי שאלות.
 */
export function readCapture() {
  if (typeof window === 'undefined') return null
  const search = params()
  const text = search.get('add')
  const name = search.get('name')
  const amount = Number(search.get('amount'))
  if (text === null && name === null) return null

  const date = search.get('date') || ''
  return {
    budgetId: search.get('budget') || null,
    text: text || '',
    name: name || '',
    // amount משותף עם ה-nudge, ולכן נקרא רק כשהוא לא זה
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    // תאריך תקין בלבד; אחרת היום, כי תאריך שבור היה נדחה בכללים
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
  }
}

export function clearDeepLink() {
  if (typeof window === 'undefined') return
  window.history.replaceState({}, '', window.location.pathname)
}

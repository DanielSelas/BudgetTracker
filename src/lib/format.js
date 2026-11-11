const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

export const shekels = (value) => currency.format(Math.round(value || 0))

export const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function monthLabel(key) {
  const [year, month] = String(key).split('-')
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`
}

/**
 * יום וחודש בלבד, לתאריך שמוצג בתוך שורה.
 * השנה אינה מוסיפה כלום לשורה שיושבת בתוך חודש מסוים, והיא גם
 * מאריכה את התווית פי שניים בדיוק במקום שבו אין מקום.
 */
export function dayMonth(date) {
  const [, month, day] = String(date || '').split('-')
  return month && day ? `${Number(day)}.${Number(month)}` : ''
}

/**
 * יום וחודש מתוך חותמת זמן של Firestore.
 *
 * מחזיר ריק גם כשהערך עדיין null, וזה קורה באמת: serverTimestamp
 * נפתר בשרת, ובין הכתיבה לאישור שלה המאזין המקומי מקבל רשומה שהשדה
 * בה ריק. בלי הבדיקה הזו השורה הייתה מהבהבת בשגיאה.
 */
export function stampDay(value) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null)
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${date.getDate()}.${date.getMonth() + 1}`
}

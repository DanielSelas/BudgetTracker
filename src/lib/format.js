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

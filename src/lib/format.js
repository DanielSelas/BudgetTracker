const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

const signedCurrency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

export const shekels = (value) => currency.format(Math.round(value || 0))
export const signedShekels = (value) => signedCurrency.format(Math.round(value || 0))

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function monthLabel(key) {
  const [year, month] = String(key).split('-')
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`
}

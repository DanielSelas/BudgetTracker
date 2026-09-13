/**
 * קישור מתוך התראת סוף החודש: /?nudge=fund&budget=<id>&amount=<x>
 * נקרא פעם אחת בעליית האפליקציה, ואז מנוקה מהכתובת כדי שרענון
 * לא יפתח את אותה מגירה שוב.
 */
export function readNudge() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('nudge') !== 'fund') return null

  const budgetId = params.get('budget')
  const amount = Number(params.get('amount'))
  return {
    budgetId: budgetId || null,
    category: 'fund',
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
  }
}

export function clearNudge() {
  if (typeof window === 'undefined') return
  window.history.replaceState({}, '', window.location.pathname)
}

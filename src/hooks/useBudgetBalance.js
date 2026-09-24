import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { entriesRef } from '../lib/paths'
import { monthKey, summarizeMonth } from '../lib/model'
import { useRetry } from './useRetry'

/**
 * החודש הנוכחי בתקציב משק בית, לתצוגה בכרטיס בדף הבית.
 *
 * מחזיר גם הכנסות והוצאות ולא רק את היתרה, כי הכרטיס מציג פס של
 * מה שנוצל מתוך ההכנסה. מקבל null כשאין מה לחשב, כדי שאפשר יהיה
 * לקרוא לו בלי תנאי.
 */
export function useMonthBalance(budgetId, fixedBase) {
  const [balance, setBalance] = useState(null)
  const { attempt, retryIfTransient } = useRetry()

  useEffect(() => {
    if (!budgetId) {
      setBalance(null)
      return
    }
    const monthQuery = query(entriesRef(budgetId), where('month', '==', monthKey()))
    return onSnapshot(
      monthQuery,
      (snapshot) => {
        const month = summarizeMonth(snapshot.docs.map((item) => item.data()), { fixedBase })
        setBalance({
          balance: month.balance,
          income: month.totalIncome,
          expenses: month.totalExpenses,
        })
      },
      (err) => { setBalance(null); retryIfTransient(err) },
    )
  }, [budgetId, fixedBase, attempt, retryIfTransient])

  return balance
}

/**
 * הסכום שנצבר בתקציב מסגרת, על פני כל החודשים.
 * במטרת חיסכון משיכה מקטינה את הצבירה, ולכן היא נספרת בסימן הפוך.
 */
export function useFrameTotal(budgetId, isGoal = false) {
  const [total, setTotal] = useState(null)
  const { attempt, retryIfTransient } = useRetry()

  useEffect(() => {
    if (!budgetId) {
      setTotal(null)
      return
    }
    return onSnapshot(
      entriesRef(budgetId),
      (snapshot) => setTotal(snapshot.docs.reduce((sum, item) => {
        const data = item.data()
        const sign = isGoal && data.category === 'withdrawal' ? -1 : 1
        return sum + (data.actualAmount || 0) * sign
      }, 0)),
      (err) => { setTotal(null); retryIfTransient(err) },
    )
  }, [budgetId, isGoal, attempt, retryIfTransient])

  return total
}

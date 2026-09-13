import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { monthKey, summarizeMonth } from '../lib/model'

/**
 * היתרה של החודש הנוכחי בתקציב משק בית, לתצוגה בכרטיס בדף הבית.
 * מקבל null כשאין מה לחשב, כדי שאפשר יהיה לקרוא לו בלי תנאי.
 */
export function useMonthBalance(budgetId) {
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!budgetId) {
      setBalance(null)
      return
    }
    const monthQuery = query(
      collection(db, 'entries'),
      where('budgetId', '==', budgetId),
      where('month', '==', monthKey()),
    )
    return onSnapshot(
      monthQuery,
      (snapshot) => setBalance(summarizeMonth(snapshot.docs.map((item) => item.data())).balance),
      () => setBalance(null),
    )
  }, [budgetId])

  return balance
}

/**
 * הסכום שנצבר בתקציב מסגרת, על פני כל החודשים.
 * במטרת חיסכון משיכה מקטינה את הצבירה, ולכן היא נספרת בסימן הפוך.
 */
export function useFrameTotal(budgetId, isGoal = false) {
  const [total, setTotal] = useState(null)

  useEffect(() => {
    if (!budgetId) {
      setTotal(null)
      return
    }
    const frameQuery = query(collection(db, 'entries'), where('budgetId', '==', budgetId))
    return onSnapshot(
      frameQuery,
      (snapshot) => setTotal(snapshot.docs.reduce((sum, item) => {
        const data = item.data()
        const sign = isGoal && data.category === 'withdrawal' ? -1 : 1
        return sum + (data.actualAmount || 0) * sign
      }, 0)),
      () => setTotal(null),
    )
  }, [budgetId, isGoal])

  return total
}

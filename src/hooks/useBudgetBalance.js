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

/** סך ההוצאה בטיול, על פני כל החודשים שהוא נמשך. */
export function useTripSpent(budgetId) {
  const [spent, setSpent] = useState(null)

  useEffect(() => {
    if (!budgetId) {
      setSpent(null)
      return
    }
    const tripQuery = query(collection(db, 'entries'), where('budgetId', '==', budgetId))
    return onSnapshot(
      tripQuery,
      (snapshot) => setSpent(
        snapshot.docs.reduce((total, item) => total + (item.data().actualAmount || 0), 0),
      ),
      () => setSpent(null),
    )
  }, [budgetId])

  return spent
}

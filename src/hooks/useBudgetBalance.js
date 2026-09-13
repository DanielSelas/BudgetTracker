import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { monthKey, summarizeMonth } from '../lib/model'

/**
 * היתרה של החודש הנוכחי לתקציב בודד, לתצוגה בכרטיס בדף הבית.
 * מאזין נפרד לכל תקציב; מספר התקציבים כאן הוא בודדים.
 */
export function useBudgetBalance(budgetId) {
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!budgetId) return
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

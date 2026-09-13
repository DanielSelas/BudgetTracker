import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { CATEGORIES } from '../lib/model'

/**
 * מאזין לרשומות של תקציב וחודש מסוימים.
 * onSnapshot מחזיר עדכון מיידי גם כשבן/בת הזוג מזינים משורה אחרת.
 */
export function useEntries(budgetId, month) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!budgetId || !month) {
      setEntries([])
      setLoading(false)
      return
    }

    setLoading(true)
    const entriesQuery = query(
      collection(db, 'entries'),
      where('budgetId', '==', budgetId),
      where('month', '==', month),
    )

    let retryTimer
    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
        // onSnapshot לא מתאושש מעצמו משגיאת הרשאה, וכזו יכולה להיות זמנית 
        // למשל בדקות הראשונות אחרי פרסום כללים, או מיד אחרי הצטרפות לתקציב.
        // בלי ניסיון חוזר השגיאה נתקעת על המסך עד רענון ידני.
        if (err.code === 'permission-denied' || err.code === 'unavailable') {
          retryTimer = setTimeout(() => setAttempt((count) => count + 1), 3000)
        }
      },
    )

    return () => {
      clearTimeout(retryTimer)
      unsubscribe()
    }
  }, [budgetId, month, attempt])

  const byCategory = useMemo(() => {
    const grouped = { income: [], fixed: [], leisure: [], fund: [] }
    for (const entry of entries) {
      if (grouped[entry.category]) grouped[entry.category].push(entry)
    }
    return grouped
  }, [entries])

  return { entries, byCategory, loading, error }
}

/** פעולות כתיבה על רשומות. budgetGroup נגזר מהקטגוריה ואינו נבחר ידנית. */
export function entryActions({ budgetId, month, uid }) {
  return {
    add: ({ category, name, plannedAmount = 0, actualAmount = 0, note = '' }) =>
      addDoc(collection(db, 'entries'), {
        budgetId,
        month,
        category,
        budgetGroup: CATEGORIES[category].budgetGroup,
        name: name.trim(),
        plannedAmount: Number(plannedAmount) || 0,
        actualAmount: Number(actualAmount) || 0,
        note,
        addedBy: uid,
      }),

    update: (entryId, changes) => updateDoc(doc(db, 'entries', entryId), changes),

    remove: (entryId) => deleteDoc(doc(db, 'entries', entryId)),
  }
}

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
import { useRetry } from './useRetry'

/**
 * מאזין לרשומות של תקציב וחודש מסוימים.
 * onSnapshot מחזיר עדכון מיידי גם כשבן/בת הזוג מזינים משורה אחרת.
 */
export function useEntries(budgetId, month) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { attempt, retryIfTransient } = useRetry()

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

    return onSnapshot(
      entriesQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
        retryIfTransient(err)
      },
    )
  }, [budgetId, month, attempt, retryIfTransient])

  const byCategory = useMemo(() => {
    const grouped = { income: [], fixed: [], leisure: [], fund: [], unplanned: [] }
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
    add: ({
      category, name, plannedAmount = 0, actualAmount = 0, note = '',
      groupKey = '', fromRemainder = false,
    }) =>
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
        // שדה ריק לא נכתב בכלל, כדי שרשומה בלי קיבוץ תישאר כפי שהייתה
        ...(groupKey ? { groupKey } : {}),
        // הפקדה שמומנה מהיתרה, ולכן מקטינה אותה ולא רק מוסיפה להפקדות
        ...(fromRemainder ? { fromRemainder: true } : {}),
      }),

    // קבוצת התקציב נגזרת מהקטגוריה ולא נבחרת, ולכן שינוי קטגוריה
    // חייב לגרור אותה. אחרת השורה הייתה נספרת ביעד של הקטגוריה הישנה
    update: (entryId, changes) => updateDoc(doc(db, 'entries', entryId), {
      ...changes,
      ...(changes.category ? { budgetGroup: CATEGORIES[changes.category].budgetGroup } : {}),
    }),

    remove: (entryId) => deleteDoc(doc(db, 'entries', entryId)),
  }
}

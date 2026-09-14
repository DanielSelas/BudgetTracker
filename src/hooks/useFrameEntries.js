import { useEffect, useState } from 'react'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { monthOfDate, todayDate } from '../lib/model'
import { useRetry } from './useRetry'

/**
 * רשומות של תקציב מבוסס מסגרת, טיול או מטרה. בניגוד למשק בית אין כאן
 * סינון לפי חודש: שניהם יחידה אחת גם כשהם חוצים חודשים.
 */
export function useFrameEntries(budgetId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { attempt, retryIfTransient } = useRetry()

  useEffect(() => {
    if (!budgetId) {
      setEntries([])
      setLoading(false)
      return
    }

    setLoading(true)
    return onSnapshot(
      query(collection(db, 'entries'), where('budgetId', '==', budgetId)),
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
  }, [budgetId, attempt, retryIfTransient])

  return { entries, loading, error }
}

export function frameActions({ budgetId, uid }) {
  return {
    add: ({ category, name, actualAmount = 0, date }) => {
      const day = date || todayDate()
      return addDoc(collection(db, 'entries'), {
        budgetId,
        category,
          // אין כאן יחס 50/30/20, ולכן אין שיוך לקבוצת תקציב
        budgetGroup: 'none',
        name: name.trim(),
        plannedAmount: 0,
        actualAmount: Number(actualAmount) || 0,
        date: day,
        // החודש נגזר מהתאריך, כך שטיול שחוצה חודשים מתפצל נכון
        month: monthOfDate(day),
        note: '',
        addedBy: uid,
      })
    },

    update: (entryId, changes) => updateDoc(doc(db, 'entries', entryId), changes),
    remove: (entryId) => deleteDoc(doc(db, 'entries', entryId)),
  }
}

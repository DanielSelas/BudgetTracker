import { useEffect, useMemo, useState } from 'react'
import {
  deleteDoc, deleteField, onSnapshot, query, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { entriesRef, entryId, entryRef } from '../lib/paths'
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
    // התקציב נמצא בנתיב, ולכן נשאר רק לסנן לפי חודש
    const entriesQuery = query(entriesRef(budgetId), where('month', '==', month))

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
      groupKey = '', fromRemainder = false, oneOff = false,
    }) =>
      setDoc(entryRef(budgetId, entryId({ month, category, name })), {
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
        // הוצאה שלא תחזור, ולכן אינה מלמדת מה רגיל: ניתוח לכלבה,
        // טלפון חדש. היא נשארת בחודש שלה במלואה ויוצאת מהמודל בלבד
        ...(oneOff ? { oneOff: true } : {}),
      }),

    // קבוצת התקציב נגזרת מהקטגוריה ולא נבחרת, ולכן שינוי קטגוריה
    // חייב לגרור אותה. אחרת השורה הייתה נספרת ביעד של הקטגוריה הישנה
    update: (id, changes) => updateDoc(entryRef(budgetId, id), {
      ...changes,
      ...(changes.category ? { budgetGroup: CATEGORIES[changes.category].budgetGroup } : {}),
      // הסימון נשמר כנוכחות השדה ולא כערך, ולכן ביטול חייב למחוק
      // אותו. כתיבת false הייתה נדחית בכללים ונשארת במסמך
      ...('oneOff' in changes && !changes.oneOff ? { oneOff: deleteField() } : {}),
    }),

    remove: (id) => deleteDoc(entryRef(budgetId, id)),
  }
}

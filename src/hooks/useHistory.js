import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { entriesRef } from '../lib/paths'
import { useRetry } from './useRetry'
import { monthKey, shiftMonth, summarizeMonth } from '../lib/model'

/** רשימת מפתחות החודשים מהישן לחדש, מסתיימת בחודש הנוכחי. */
export function recentMonths(count) {
  const current = monthKey()
  return Array.from({ length: count }, (_, index) => shiftMonth(current, index - count + 1))
}

/**
 * מאזין לכל הרשומות של התקציב מחודש מסוים ואילך, ומסכם כל חודש בנפרד.
 * הסינון הוא טווח על מחרוזת החודש, שמסודרת לקסיקוגרפית בדיוק כמו כרונולוגית.
 */
export function useHistory(budgetId, monthCount = 6, fixedBase = 0) {
  const months = useMemo(() => recentMonths(monthCount), [monthCount])
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
    const historyQuery = query(entriesRef(budgetId), where('month', '>=', months[0]))

    return onSnapshot(
      historyQuery,
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
  }, [budgetId, months, attempt, retryIfTransient])

  const series = useMemo(() => {
    const byMonth = new Map(months.map((month) => [month, []]))
    for (const entry of entries) {
      if (byMonth.has(entry.month)) byMonth.get(entry.month).push(entry)
    }
    return months.map((month) => ({ month, ...summarizeMonth(byMonth.get(month), { fixedBase }) }))
  }, [entries, months, fixedBase])

  const hasData = useMemo(
    () => series.some((point) => point.totalIncome > 0 || point.totalExpenses > 0),
    [series],
  )

  return { series, months, loading, error, hasData }
}

import { useEffect, useRef, useState } from 'react'
import { syncRollup, totalsByMonth } from '../lib/trips'

/**
 * מיישר את השורות המסכמות בתקציב הבית בכל פעם שהטיול משתנה.
 * שומר את החודשים שכבר טופלו, כדי שחודש שהתרוקן יימחק גם הוא ולא
 * יישאר תלוי בבית בלי מקור.
 */
export function useTripRollup({ trip, entries, uid, ready }) {
  const [error, setError] = useState(null)
  const [syncedAt, setSyncedAt] = useState(null)
  const seenMonths = useRef(new Set())
  const lastSignature = useRef('')

  useEffect(() => {
    if (!ready || !trip?.linkedBudgetId || !uid) return

    const totals = totalsByMonth(entries)
    const signature = [...totals.entries()].sort().map(([m, v]) => `${m}:${v}`).join('|')
    if (signature === lastSignature.current) return
    lastSignature.current = signature

    const knownMonths = [...seenMonths.current]
    for (const month of totals.keys()) seenMonths.current.add(month)

    syncRollup({ trip, entries, uid, knownMonths })
      .then(() => { setError(null); setSyncedAt(Date.now()) })
      .catch(setError)
  }, [trip, entries, uid, ready])

  return { error, syncedAt }
}

import { useEffect, useRef, useState } from 'react'
import { goalSign, syncRollup, totalsByMonth } from '../lib/trips'

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

    // אותו חישוב כמו בסנכרון עצמו: משיכה שמקזזת הפקדה משנה את הסכום
    // בבית, ולכן היא חייבת לשנות גם את החתימה שמחליטה אם לסנכרן.
    const totals = totalsByMonth(entries, trip.type === 'goal' ? goalSign : undefined)

    // התקציב המקושר הוא חלק מהחתימה, ולא רק הסכומים. בלעדיו קישור
    // מחדש לאותו תקציב, או החלפה לאחר, לא מסנכרנים כלל: הסכומים לא
    // השתנו. וניתוק מוחק את השורות מהתקציב הקודם, ולכן הן נעלמו
    // ולא חזרו
    const signature = [
      trip.linkedBudgetId,
      ...[...totals.entries()].sort().map(([month, value]) => `${month}:${value}`),
    ].join('|')
    if (signature === lastSignature.current) return
    lastSignature.current = signature

    const knownMonths = [...seenMonths.current]
    for (const month of totals.keys()) seenMonths.current.add(month)

    syncRollup({ trip, entries, uid, knownMonths })
      .then(() => { setError(null); setSyncedAt(Date.now()) })
      .catch((failure) => {
        // בלי איפוס החתימה ניסיון שנכשל לא חוזר לעולם, כי כל ריצה
        // נוספת רואה את אותה חתימה ומדלגת
        lastSignature.current = ''
        setError(failure)
      })
  }, [trip, entries, uid, ready])

  return { error, syncedAt }
}

import { useEffect, useState } from 'react'
import { watchSectorRules } from '../lib/sectors'

/**
 * מה שנלמד על ענפים בתקציב הזה.
 *
 * נטען ברקע ולא חוסם: בלי הכללים הייבוא עדיין עובד, פשוט בלי
 * הצעות, ולכן שגיאה כאן לא אמורה למנוע ייבוא.
 */
export function useSectorRules(budgetId) {
  const [rules, setRules] = useState({})

  useEffect(() => {
    if (!budgetId) return undefined
    return watchSectorRules(budgetId, setRules, () => setRules({}))
  }, [budgetId])

  return rules
}

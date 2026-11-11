import { useEffect, useState } from 'react'
import { watchInbox } from '../lib/inbox'

/**
 * ההוצאות שממתינות לאישור בתקציב הזה.
 *
 * שגיאה כאן מתורגמת לתיבה ריקה ולא נזרקת למעלה: התיבה היא תוספת
 * מעל התקציב, וכשל בקריאה שלה אינו סיבה למנוע את מסך החודש כולו.
 */
export function useInbox(budgetId) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!budgetId) {
      setItems([])
      return undefined
    }
    return watchInbox(budgetId, setItems, () => setItems([]))
  }, [budgetId])

  return items
}

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * onSnapshot לא מתאושש מעצמו משגיאת הרשאה, והשגיאה הזו יכולה להיות
 * זמנית לגמרי: בדקות הראשונות אחרי פרסום כללים, ומיד אחרי הצטרפות
 * לתקציב עם קוד הזמנה. בלי ניסיון חוזר המסך נתקע עד רענון ידני.
 *
 * היה כאן ניסיון חוזר במסך החודש בלבד, ולכן מסך הטיול, מסך המטרה
 * וההיסטוריה נתקעו במצב שממנו מסך אחד באותה אפליקציה כן התאושש.
 */
const RETRY_MS = 3000
const TRANSIENT = ['permission-denied', 'unavailable']

export function useRetry() {
  const [attempt, setAttempt] = useState(0)
  const timer = useRef()

  const retryIfTransient = useCallback((error) => {
    if (!TRANSIENT.includes(error?.code)) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAttempt((count) => count + 1), RETRY_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { attempt, retryIfTransient }
}

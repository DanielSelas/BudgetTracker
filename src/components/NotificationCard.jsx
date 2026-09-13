import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { disableNotifications, enableNotifications, notificationState } from '../lib/messaging'

const MESSAGES = {
  'needs-install': 'התראות עובדות רק אחרי שמוסיפים את האפליקציה למסך הבית.',
  unsupported: 'הדפדפן הזה לא תומך בהתראות.',
  blocked: 'ההתראות חסומות בהגדרות הדפדפן. צריך לאשר אותן שם כדי להפעיל.',
  off: 'נשלח תזכורת ביום האחרון של החודש, אם נשאר כסף שלא הוצא.',
  enabled: 'נשלח תזכורת ביום האחרון של החודש, אם נשאר כסף שלא הוצא.',
}

export default function NotificationCard() {
  const { user } = useAuth()
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    notificationState().then(setState)
  }, [])

  // 'unconfigured' אומר שאין מפתח VAPID. אין טעם להציג כלום למשתמש.
  if (state === null || state === 'unconfigured') return null

  const canToggle = state === 'off' || state === 'enabled'

  async function toggle() {
    setBusy(true)
    setError('')
    try {
      setState(state === 'enabled'
        ? await disableNotifications(user.uid)
        : await enableNotifications(user.uid))
    } catch {
      setError('ההפעלה נכשלה. נסו שוב')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="notify-card">
      <div className="notify-text">
        <h2>תזכורת סוף חודש</h2>
        <p className="sub">{MESSAGES[state]}</p>
      </div>

      {canToggle && (
        <button
          type="button"
          className="recur-toggle"
          aria-pressed={state === 'enabled'}
          disabled={busy}
          onClick={toggle}
        >
          {state === 'enabled' ? 'פעיל' : 'כבוי'}
          <span className="switch"><span className="knob" /></span>
        </button>
      )}

      {error && <p className="notice block" role="alert">{error}</p>}
    </section>
  )
}

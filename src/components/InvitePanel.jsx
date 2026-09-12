import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createInvite } from '../lib/budgets'

export default function InvitePanel({ budgetId }) {
  const { user } = useAuth()
  const [invite, setInvite] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    setError('')
    setBusy(true)
    try {
      setInvite(await createInvite({ uid: user.uid, budgetId }))
      setCopied(false)
    } catch {
      setError('יצירת ההזמנה נכשלה')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
    } catch {
      setError('ההעתקה נכשלה. אפשר לסמן ולהעתיק ידנית')
    }
  }

  return (
    <section className="card">
      <h2>הזמנת שותף</h2>

      {invite ? (
        <>
          <p className="subtitle">
            הקוד תקף עד {invite.expiresAt.toLocaleDateString('he-IL')}, וניתן לשימוש פעם אחת.
          </p>
          <output className="invite-code">{invite.code}</output>
          <button type="button" className="secondary" onClick={handleCopy}>
            {copied ? 'הועתק ✓' : 'העתק קוד'}
          </button>
          <button type="button" className="link" onClick={handleCreate} disabled={busy}>
            צור קוד אחר
          </button>
        </>
      ) : (
        <>
          <p className="subtitle">
            צור קוד חד-פעמי ושלח אותו. מי שמזין אותו מצטרף לתקציב הזה.
          </p>
          <button type="button" onClick={handleCreate} disabled={busy}>
            {busy ? 'יוצר...' : 'צור קוד הזמנה'}
          </button>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createInvite } from '../lib/budgets'

export default function InvitePanel({ budgetId, budgetName, showName }) {
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
    <section className="invite-panel">
      <h2>להזמין את בן/בת הזוג</h2>
      <p className="sub">
        {invite
          ? `קוד חד פעמי, תקף עד ${invite.expiresAt.toLocaleDateString('he-IL')}.`
          : 'קוד חד פעמי לשבוע, נשלח בוואטסאפ.'}
        {showName && budgetName ? ` לתקציב "${budgetName}".` : ''}
      </p>

      {invite ? (
        <>
          <span className="invite-code">{invite.code}</span>
          <div className="invite-actions">
            <button type="button" className="chip-button" onClick={handleCopy}>
              {copied ? 'הועתק ✓' : 'העתקת הקוד'}
            </button>
            <button type="button" className="chip-button" onClick={handleCreate} disabled={busy}>
              קוד אחר
            </button>
          </div>
        </>
      ) : (
        <div className="invite-actions">
          <button type="button" className="chip-button" onClick={handleCreate} disabled={busy}>
            {busy ? 'יוצר...' : 'יצירת קוד הזמנה'}
          </button>
        </div>
      )}

      {error && <p className="notice block" role="alert">{error}</p>}
    </section>
  )
}

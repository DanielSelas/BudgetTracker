import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createBudget, joinBudgetWithInvite } from '../lib/budgets'

const JOIN_MESSAGES = {
  invalid: 'הקוד חייב להכיל 8 תווים',
  'not-found': 'לא נמצאה הזמנה עם הקוד הזה',
  used: 'הקוד הזה כבר נוצל',
  expired: 'תוקף הקוד פג. בקש קוד חדש',
}

export default function BudgetSetup({ onDone, canCancel = false }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const budgetId = await createBudget({ uid: user.uid, name })
      onDone?.(budgetId)
    } catch {
      setError('יצירת התקציב נכשלה. נסה שוב')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await joinBudgetWithInvite({ uid: user.uid, rawCode: code })
      if (result.status === 'joined') onDone?.(result.budgetId)
      else setError(JOIN_MESSAGES[result.status] || 'ההצטרפות נכשלה')
    } catch {
      setError('ההצטרפות נכשלה. ודא שהקוד נכון ונסה שוב')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="tabs">
        <button
          type="button"
          className={mode === 'create' ? '' : 'secondary'}
          onClick={() => { setMode('create'); setError('') }}
        >
          תקציב חדש
        </button>
        <button
          type="button"
          className={mode === 'join' ? '' : 'secondary'}
          onClick={() => { setMode('join'); setError('') }}
        >
          הצטרפות עם קוד
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="stack">
          <label htmlFor="budget-name">שם התקציב</label>
          <input
            id="budget-name"
            className="rtl"
            required
            maxLength={60}
            placeholder="למשל: תקציב משפחתי"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'יוצר...' : 'צור תקציב'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="stack">
          <label htmlFor="invite-code">קוד הזמנה</label>
          <input
            id="invite-code"
            className="code-input"
            required
            maxLength={11}
            placeholder="ABCD2345"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button type="submit" disabled={busy || !code.trim()}>
            {busy ? 'מצטרף...' : 'הצטרף'}
          </button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {canCancel && (
        <button type="button" className="link" onClick={() => onDone?.(null)}>ביטול</button>
      )}
    </section>
  )
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createBudget, joinBudgetWithInvite } from '../lib/budgets'

const JOIN_MESSAGES = {
  invalid: 'הקוד חייב להכיל 8 תווים',
  'not-found': 'לא נמצאה הזמנה עם הקוד הזה',
  used: 'הקוד הזה כבר נוצל',
  expired: 'תוקף הקוד פג. בקשו קוד חדש',
}

export default function BudgetSetup({ asSheet = false, onDone, onClose }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const who = user.displayName || user.email || ''

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'create') {
        const budgetId = await createBudget({ uid: user.uid, name, displayName: who })
        onDone?.(budgetId)
      } else {
        const result = await joinBudgetWithInvite({ uid: user.uid, rawCode: code, displayName: who })
        if (result.status === 'joined') onDone?.(result.budgetId)
        else { setError(JOIN_MESSAGES[result.status] || 'ההצטרפות נכשלה'); setBusy(false) }
      }
    } catch {
      setError(mode === 'create' ? 'יצירת התקציב נכשלה' : 'ההצטרפות נכשלה. ודאו שהקוד נכון')
      setBusy(false)
    }
  }

  const body = (
    <form className="sheet" onSubmit={handleSubmit} role="dialog" aria-modal="true">
      {asSheet && <span className="sheet-handle" />}
      <h2>{mode === 'create' ? 'תקציב חדש' : 'הצטרפות עם קוד'}</h2>

      <div className="cat-pills">
        <button
          type="button"
          className="cat-pill"
          data-category="fixed"
          aria-pressed={mode === 'create'}
          onClick={() => { setMode('create'); setError('') }}
        >
          תקציב חדש
        </button>
        <button
          type="button"
          className="cat-pill"
          data-category="income"
          aria-pressed={mode === 'join'}
          onClick={() => { setMode('join'); setError('') }}
        >
          הצטרפות עם קוד
        </button>
      </div>

      {mode === 'create' ? (
        <label className="field">
          שם התקציב
          <input
            className="input"
            required
            maxLength={60}
            placeholder="למשל: משק הבית"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
      ) : (
        <label className="field">
          קוד הזמנה
          <input
            className="input code ltr"
            required
            maxLength={11}
            placeholder="ABCD2345"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoFocus
          />
        </label>
      )}

      {error && <p className="notice block" role="alert">{error}</p>}

      <div className="sheet-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || (mode === 'create' ? !name.trim() : !code.trim())}
        >
          {busy ? 'רגע...' : mode === 'create' ? 'יצירה' : 'הצטרפות'}
        </button>
        {onClose && (
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
        )}
      </div>
    </form>
  )

  if (!asSheet) return body

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.() }}
    >
      {body}
    </div>
  )
}

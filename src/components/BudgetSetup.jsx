import { useState } from 'react'
import Sheet from './Sheet'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { createBudget, joinBudgetWithInvite } from '../lib/budgets'
import { BUDGET_TYPES, DEFAULT_BILLING_DAY, isFrameBudget } from '../lib/model'
import BillingDayField from './BillingDayField'

const JOIN_MESSAGES = {
  invalid: 'הקוד חייב להכיל 8 תווים',
  'not-found': 'לא נמצאה הזמנה עם הקוד הזה',
  used: 'הקוד הזה כבר נוצל',
  expired: 'תוקף הקוד פג. בקשו קוד חדש',
}

export default function BudgetSetup({ asSheet = false, onDone, onClose }) {
  const { user } = useAuth()
  const { budgets } = useBudget()
  const [mode, setMode] = useState('create')
  const [type, setType] = useState('household')
  const [name, setName] = useState('')
  const [frame, setFrame] = useState('')
  const [linkedBudgetId, setLinkedBudgetId] = useState('')
  const [billingDay, setBillingDay] = useState(DEFAULT_BILLING_DAY)
  const [baseAmount, setBaseAmount] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const who = user.displayName || user.email || ''
  // אפשר לקשר רק לתקציבי משק בית שאתה כבר חבר בהם
  const linkTargets = (budgets || []).filter((budget) => !isFrameBudget(budget))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'join') {
        const result = await joinBudgetWithInvite({ uid: user.uid, rawCode: code, displayName: who })
        if (result.status === 'joined') onDone?.(result.budgetId)
        else { setError(JOIN_MESSAGES[result.status] || 'ההצטרפות נכשלה'); setBusy(false) }
        return
      }

      const budgetId = await createBudget({
        uid: user.uid,
        name,
        displayName: who,
        type,
        frame: frameBudget ? Number(frame) || 0 : 0,
        linkedBudgetId: frameBudget && linkedBudgetId ? linkedBudgetId : null,
        billingDay,
        baseAmount: Number(baseAmount) || 0,
      })
      onDone?.(budgetId)
    } catch {
      setError(mode === 'create' ? 'יצירת התקציב נכשלה' : 'ההצטרפות נכשלה. ודאו שהקוד נכון')
      setBusy(false)
    }
  }

  const creating = mode === 'create'
  const goal = type === 'goal'
  const frameBudget = type === 'trip' || goal
  const canSubmit = creating ? name.trim() && (!frameBudget || Number(frame) > 0) : code.trim()

  const body = (
    <form className={asSheet ? 'sheet-form' : 'sheet sheet-static'} onSubmit={handleSubmit}>
      <h2>{creating ? 'תקציב חדש' : 'הצטרפות עם קוד'}</h2>

      <div className="cat-pills">
        <button
          type="button" className="cat-pill" data-category="fixed"
          aria-pressed={creating}
          onClick={() => { setMode('create'); setError('') }}
        >
          תקציב חדש
        </button>
        <button
          type="button" className="cat-pill" data-category="income"
          aria-pressed={!creating}
          onClick={() => { setMode('join'); setError('') }}
        >
          הצטרפות עם קוד
        </button>
      </div>

      {creating ? (
        <>
          <div className="type-choice">
            {Object.entries(BUDGET_TYPES).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className="type-option"
                aria-pressed={type === key}
                onClick={() => setType(key)}
              >
                <span className="type-label">{meta.label}</span>
                <span className="type-hint">{meta.hint}</span>
              </button>
            ))}
          </div>

          <label className="field">
            שם התקציב
            <input
              className="input" required maxLength={60}
              placeholder={
                goal ? 'למשל: רכב חדש'
                  : frameBudget ? 'למשל: יוון באוגוסט'
                    : 'למשל: משק הבית'
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          {!frameBudget && (
            <>
              <label className="field">
                סכום הבסיס לחודש
                <input
                  className="input num" type="number" inputMode="decimal" min="0" step="500"
                  placeholder="אוטומטי לפי ההכנסה"
                  value={baseAmount}
                  onChange={(event) => setBaseAmount(event.target.value)}
                />
                <span className="type-hint">
                  הסכום שאתם מתכננים לחלק כל חודש, והיעדים נגזרים ממנו.
                  מה שייכנס מעבר לו יופיע כיתרה. אפשר להשאיר ריק, ואז
                  הוא ייגזר מההכנסה של כל חודש.
                </span>
              </label>

              <BillingDayField value={billingDay} onChange={setBillingDay} />
            </>
          )}

          {frameBudget && (
            <>
              <label className="field">
                {goal ? 'סכום היעד' : 'מסגרת לטיול'}
                <input
                  className="input num" type="number" inputMode="decimal" min="0" step="1"
                  required placeholder="0"
                  value={frame}
                  onChange={(event) => setFrame(event.target.value)}
                />
              </label>

              {linkTargets.length > 0 && (
                <label className="field">
                  {goal ? 'לזקוף להפקדות של' : 'לחייב את היתרה של'}
                  <select
                    className="input rtl"
                    value={linkedBudgetId}
                    onChange={(event) => setLinkedBudgetId(event.target.value)}
                  >
                    <option value="">בלי קישור</option>
                    {linkTargets.map((budget) => (
                      <option key={budget.id} value={budget.id}>{budget.name}</option>
                    ))}
                  </select>
                  <span className="type-hint">
                    {goal
                      ? 'ההפקדות יופיעו שם כשורה מסכמת אחת לכל חודש.'
                      : 'הוצאות הטיול יופיעו שם כשורה מסכמת אחת לכל חודש.'}
                  </span>
                </label>
              )}
            </>
          )}
        </>
      ) : (
        <label className="field">
          קוד הזמנה
          <input
            className="input code ltr" required maxLength={11} placeholder="ABCD2345"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
      )}

      {error && <p className="notice block" role="alert">{error}</p>}

      <div className="sheet-actions">
        <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
          {busy ? 'רגע...' : creating ? 'יצירה' : 'הצטרפות'}
        </button>
        {onClose && (
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
        )}
      </div>
    </form>
  )

  if (!asSheet) return body
  return <Sheet onClose={onClose}>{body}</Sheet>
}

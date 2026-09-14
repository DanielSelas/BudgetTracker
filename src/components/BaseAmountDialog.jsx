import { useState } from 'react'
import { shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, CATEGORIES, groupTarget } from '../lib/model'

const PREVIEW = [
  { group: 'fixed', label: CATEGORIES.fixed.label },
  { group: 'leisure', label: CATEGORIES.leisure.label },
  { group: 'savings', label: CATEGORIES.fund.label },
]

/**
 * קביעת סכום הבסיס. התצוגה המקדימה כאן היא העיקר: הבסיס הוא מספר
 * מופשט, והיעדים שנגזרים ממנו הם מה שבאמת מרגישים.
 */
export default function BaseAmountDialog({ value, onSave, onCancel }) {
  const [amount, setAmount] = useState(value ? String(value) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = Number(amount) || 0

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSave(base)
    } catch {
      setError('השמירה נכשלה')
      setBusy(false)
    }
  }

  return (
    <div
      className="sheet-backdrop middle"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}
    >
      <form className="dialog" role="dialog" aria-modal="true" onSubmit={submit}>
        <h2>סכום הבסיס</h2>
        <p>
          הסכום שאתם מתכננים לחלק כל חודש. מה שייכנס מעבר לו יופיע כיתרה,
          עם הצעה להפקיד אותו.
        </p>

        <label className="field">
          סכום לחודש
          <input
            className="input num" type="number" inputMode="decimal" min="0" step="500"
            placeholder="אוטומטי לפי ההכנסה"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>

        {base > 0 ? (
          <ul className="entry-list">
            {PREVIEW.map(({ group, label }) => (
              <li className="entry-row" key={group}>
                <span className="entry-name">{label}</span>
                <span className="recurring-tag as-tag">
                  {Math.round(BUDGET_GROUP_RATIOS[group] * 100)}%
                </span>
                <span className="entry-amount num">{shekels(groupTarget(base, group))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">ריק או אפס מחזיר לגזירה אוטומטית מההכנסה של כל חודש.</p>
        )}

        {error && <p className="notice block" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </form>
    </div>
  )
}

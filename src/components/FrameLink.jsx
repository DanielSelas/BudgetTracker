import { useMemo, useState } from 'react'
import { useBudget } from '../context/BudgetContext'
import { setFrameLink } from '../lib/budgets'
import { isFrameBudget } from '../lib/model'

/**
 * מצב הקישור לתקציב הבית, ואפשרות לשנות אותו.
 * קודם זה נקבע רק ביצירה, וכשלא נבחר שם תקציב המסך פשוט שתק: לא היה
 * שום סימן לכך שאין קישור, ולכן גם לא היה מה לתקן.
 */
export default function FrameLink({ budgetId, budget, months, synced, kind = 'trip' }) {
  const { budgets } = useBudget()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const targets = useMemo(
    () => (budgets || []).filter((item) => !isFrameBudget(item) && item.id !== budgetId),
    [budgets, budgetId],
  )

  const linked = budget?.linkedBudgetId
    ? (budgets || []).find((item) => item.id === budget.linkedBudgetId)
    : null

  async function choose(nextId) {
    setBusy(true)
    setError('')
    try {
      await setFrameLink({
        budgetId,
        previousLinkedId: budget?.linkedBudgetId || null,
        months,
        linkedBudgetId: nextId,
      })
      setEditing(false)
    } catch {
      setError('עדכון הקישור נכשל')
    }
    setBusy(false)
  }

  if (editing) {
    return (
      <div className="hint center link-edit">
        <select
          className="input rtl"
          disabled={busy}
          value={budget?.linkedBudgetId || ''}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="">בלי קישור</option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {error && <span className="danger-text">{error}</span>}
        <button type="button" className="btn-text" onClick={() => setEditing(false)}>ביטול</button>
      </div>
    )
  }

  const what = kind === 'goal' ? 'ההפקדות' : 'ההוצאות'
  const where = kind === 'goal' ? 'בקרן' : 'בשארית'

  return (
    <p className="hint center">
      {budget?.linkedBudgetId ? (
        <>
          {what} כאן מופיעות גם {where} של {linked?.name || 'תקציב הבית'}, כשורה אחת לכל חודש.
          {synced ? ' מסונכרן ✓' : ''}
        </>
      ) : (
        <>לא מקושר לתקציב בית, ולכן {what} נשארות כאן בלבד.</>
      )}
      {targets.length > 0 && (
        <>
          {' '}
          <button type="button" className="btn-text inline" onClick={() => setEditing(true)}>
            {budget?.linkedBudgetId ? 'שינוי' : 'קישור'}
          </button>
        </>
      )}
    </p>
  )
}

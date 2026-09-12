import { useState } from 'react'

const EMPTY = { name: '', plannedAmount: '', actualAmount: '', recurring: false }

export default function EntryForm({ category, onSubmit, onCancel }) {
  const [values, setValues] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isIncome = category === 'income'

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!values.name.trim()) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        category,
        name: values.name,
        plannedAmount: Number(values.plannedAmount) || 0,
        actualAmount: Number(values.actualAmount) || 0,
        recurring: values.recurring,
      })
      setValues(EMPTY)
    } catch {
      setError('השמירה נכשלה. נסה שוב')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <input
        className="rtl"
        required
        maxLength={100}
        placeholder={isIncome ? 'מקור ההכנסה' : 'שם ההוצאה'}
        value={values.name}
        onChange={(event) => setField('name', event.target.value)}
        autoFocus
      />
      <div className="amounts">
        <label>
          <span>מתוכנן</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="0"
            value={values.plannedAmount}
            onChange={(event) => setField('plannedAmount', event.target.value)}
          />
        </label>
        <label>
          <span>בפועל</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="0"
            value={values.actualAmount}
            onChange={(event) => setField('actualAmount', event.target.value)}
          />
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={values.recurring}
          onChange={(event) => setField('recurring', event.target.checked)}
        />
        <span>
          {isIncome ? 'הכנסה קבועה' : 'חיוב קבוע'}
          <span className="hint">, יתווסף אוטומטית בכל חודש</span>
        </span>
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row-actions">
        <button type="submit" disabled={busy || !values.name.trim()}>
          {busy ? 'שומר...' : 'הוסף'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>ביטול</button>
      </div>
    </form>
  )
}

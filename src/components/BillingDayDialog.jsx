import { useState } from 'react'
import BillingDayField from './BillingDayField'
import { DEFAULT_BILLING_DAY, isBillingDay } from '../lib/model'

/** שינוי מועד החיוב אחרי היצירה. */
export default function BillingDayDialog({ value, onSave, onCancel }) {
  const [day, setDay] = useState(Number(value) || DEFAULT_BILLING_DAY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!isBillingDay(day)) {
      setError('יום בין 1 ל-28')
      return
    }
    setBusy(true)
    try {
      await onSave(day)
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
        <h2>מועד החיוב</h2>
        <BillingDayField value={day} onChange={setDay} label="" />
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

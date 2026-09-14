import { useState } from 'react'

/** דיאלוג קצר לשינוי שם, באותו מבנה של דיאלוג האישור. */
export default function RenameDialog({ title, label, value, onSave, onCancel }) {
  const [name, setName] = useState(value || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const clean = name.trim()

  async function submit(event) {
    event.preventDefault()
    if (!clean) {
      setError('צריך שם')
      return
    }
    setBusy(true)
    try {
      await onSave(clean)
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
        <h2>{title}</h2>
        <label className="field">
          {label}
          <input
            className="input"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="notice block" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={busy || !clean}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </form>
    </div>
  )
}

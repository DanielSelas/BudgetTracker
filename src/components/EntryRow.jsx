import { useState } from 'react'
import { shekels } from '../lib/format'
import { isEntryConcerning } from '../lib/model'

export default function EntryRow({ entry, onUpdate, onRemove, onStopRecurring, showAuthor }) {
  const [editing, setEditing] = useState(false)
  const [actual, setActual] = useState(String(entry.actualAmount ?? 0))
  const [busy, setBusy] = useState(false)

  const planned = entry.plannedAmount || 0
  const concerning = isEntryConcerning(entry)

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await onUpdate(entry.id, { actualAmount: Number(actual) || 0 })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="entry-row editing">
        <form onSubmit={save} className="inline-edit">
          <span className="entry-name">{entry.name}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy}>שמור</button>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>
            ביטול
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="entry-row">
      <div className="entry-main">
        <span className="entry-name">{entry.name}</span>
        {planned > 0 && (
          <span className={`entry-planned num ${concerning ? 'over' : ''}`}>
            מתוכנן {shekels(planned)}
          </span>
        )}
        {showAuthor && entry.addedBy && (
          <span className="entry-author">{showAuthor}</span>
        )}
        {entry.recurringId && (
          <button
            type="button"
            className="badge"
            title="לחיצה מפסיקה את החיוב הקבוע מהחודש הבא"
            onClick={() => onStopRecurring?.(entry)}
          >
            קבוע ↻
          </button>
        )}
      </div>

      <button type="button" className="amount-button num" onClick={() => setEditing(true)}>
        {shekels(entry.actualAmount)}
      </button>

      <button
        type="button"
        className="icon"
        aria-label={entry.recurringId ? `הסרת ${entry.name} מהחודש הזה` : `מחיקת ${entry.name}`}
        onClick={() => onRemove(entry.id, entry)}
      >
        ✕
      </button>
    </li>
  )
}

import { useState } from 'react'
import Avatar from './Avatar'
import { shekels } from '../lib/format'
import { displayName } from '../lib/members'

export default function EntryRow({ entry, author, onUpdate, onRemove, onStopRecurring }) {
  const [editing, setEditing] = useState(false)
  const [actual, setActual] = useState(String(entry.actualAmount ?? 0))
  const [busy, setBusy] = useState(false)

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

  if (entry.linkedTripId) {
    return (
      <li className="entry-row">
        <span className="entry-name">{entry.name}</span>
        <span className="recurring-tag as-tag">מקושר</span>
        <span className="entry-amount num">{shekels(entry.actualAmount)}</span>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="entry-row">
        <form className="inline-edit" onSubmit={save}>
          <span className="entry-name">{entry.name}</span>
          <input
            className="input num"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            autoFocus
          />
          <button type="submit" className="mini save" disabled={busy}>שמור</button>
          <button type="button" className="mini cancel" onClick={() => setEditing(false)}>
            ביטול
          </button>
          <button
            type="button"
            className="mini remove"
            onClick={() => onRemove(entry.id, entry)}
            title={entry.recurringId ? 'הסרה מהחודש הזה' : 'מחיקת השורה'}
          >
            מחיקה
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="entry-row">
      <span className="entry-name">{entry.name}</span>

      {entry.recurringId && (
        <button
          type="button"
          className="recurring-tag"
          title="לחיצה מפסיקה את החיוב הקבוע מהחודש הבא"
          onClick={() => onStopRecurring?.(entry)}
        >
          קבוע
        </button>
      )}

      {author && (
        <Avatar
          member={author.member}
          index={author.index}
          size="sm"
          title={`הוזן על ידי ${displayName(author.member)}`}
        />
      )}

      <button
        type="button"
        className="entry-amount button num"
        onClick={() => setEditing(true)}
        aria-label={`עריכה או מחיקה של ${entry.name}`}
      >
        {shekels(entry.actualAmount)}
      </button>
    </li>
  )
}

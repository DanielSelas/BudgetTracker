import { useState } from 'react'
import Avatar from './Avatar'
import { shekels } from '../lib/format'
import { displayName } from '../lib/members'

/**
 * שורה בכרטיס קטגוריה, ועריכה שלה במקום.
 *
 * קודם אפשר היה לערוך רק את הסכום, ולכן תיקון שם או קטגוריה חייב
 * מחיקה והזנה מחדש. בשורה שנוצרה מחיוב קבוע זה היה גרוע במיוחד:
 * המחיקה מדלגת על החודש בתבנית, כך שמי שרק רצה לתקן שם גרם לשורה
 * לא לחזור, בלי שאמרו לו.
 */
export default function EntryRow({
  entry, author, categories = [], onUpdate, onRemove, onStopRecurring,
}) {
  const [editing, setEditing] = useState(false)
  const [actual, setActual] = useState(String(entry.actualAmount ?? 0))
  const [name, setName] = useState(entry.name || '')
  const [category, setCategory] = useState(entry.category)
  const [busy, setBusy] = useState(false)

  function open() {
    setActual(String(entry.actualAmount ?? 0))
    setName(entry.name || '')
    setCategory(entry.category)
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const changes = { actualAmount: Number(actual) || 0 }
      const trimmed = name.trim()
      if (trimmed && trimmed !== entry.name) changes.name = trimmed
      if (category !== entry.category) changes.category = category
      await onUpdate(entry.id, changes)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  // שורה מסכמת של טיול או מטרה נגזרת ממקום אחר, ולכן היא לקריאה בלבד
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
      <li className="entry-row editing">
        <form className="row-edit" onSubmit={save}>
          <input
            className="input"
            maxLength={100}
            value={name}
            placeholder="שם השורה"
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />

          {categories.length > 1 && (
            <div className="cat-pills tight">
              {categories.map((option) => (
                <button
                  key={option.category}
                  type="button"
                  className="cat-pill"
                  data-category={option.category}
                  aria-pressed={category === option.category}
                  onClick={() => setCategory(option.category)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="row-edit-foot">
            <input
              className="input num"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
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
          </div>

          {entry.recurringId && (
            <span className="type-hint">
              השינוי חל על החודש הזה. בחודש הבא השורה תיווצר שוב מהתבנית.
            </span>
          )}
        </form>
      </li>
    )
  }

  return (
    <li className="entry-row">
      <button
        type="button"
        className="entry-name as-button"
        onClick={open}
        aria-label={`עריכה של ${entry.name}`}
      >
        {entry.name}
      </button>

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
          profile={author.profile}
          size="sm"
          title={`הוזן על ידי ${displayName(author.member, author.profile)}`}
        />
      )}

      <button type="button" className="entry-amount button num" onClick={open}>
        {shekels(entry.actualAmount)}
      </button>
    </li>
  )
}

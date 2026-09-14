import { useState } from 'react'
import EntryRow from './EntryRow'
import { shekels } from '../lib/format'

/**
 * שורה מקובצת בתוך כרטיס קטגוריה: סכום אחד שמייצג כמה קניות.
 * סגורה כברירת מחדל, כי הערך שלה הוא בדיוק זה, לא לראות את הפירוט.
 */
export default function EntryGroup({ group, authorOf, actions, onStopRecurring, onAdd }) {
  const [open, setOpen] = useState(false)
  const count = group.entries.length

  return (
    <li className="entry-group" data-open={open || undefined}>
      <button
        type="button"
        className="group-head"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="chevron" aria-hidden="true">▾</span>
        <span className="entry-name">{group.key}</span>
        <span className="group-count">{count === 1 ? 'קנייה אחת' : `${count} קניות`}</span>
        <span className="entry-amount num">{shekels(group.total)}</span>
      </button>

      {open && (
        <>
          <ul className="entry-list nested">
            {group.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                author={authorOf?.(entry.addedBy)}
                onUpdate={actions.update}
                onRemove={actions.remove}
                onStopRecurring={onStopRecurring}
              />
            ))}
          </ul>

          <button type="button" className="btn-text nested-add" onClick={() => onAdd?.(group.key)}>
            + הוספה ל{group.key}
          </button>
        </>
      )}
    </li>
  )
}

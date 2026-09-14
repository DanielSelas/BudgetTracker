import EntryRow from './EntryRow'
import EntryGroup from './EntryGroup'
import { groupEntries } from '../lib/groups'

/** רשימת השורות של קטגוריה, כשרשומות מקובצות מוצגות כשורה אחת מכווצת. */
export default function EntryItems({
  entries, authorOf, actions, categories, onStopRecurring, onAddToGroup,
}) {
  const items = groupEntries(entries)

  return (
    <ul className="entry-list">
      {items.map((item) => (
        item.kind === 'group' ? (
          <EntryGroup
            key={item.id}
            group={item}
            authorOf={authorOf}
            actions={actions}
            categories={categories}
            onStopRecurring={onStopRecurring}
            onAdd={onAddToGroup}
          />
        ) : (
          <EntryRow
            key={item.id}
            entry={item.entry}
            author={authorOf?.(item.entry.addedBy)}
            categories={categories}
            onUpdate={actions.update}
            onRemove={actions.remove}
            onStopRecurring={onStopRecurring}
          />
        )
      ))}
    </ul>
  )
}

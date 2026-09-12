import { useState } from 'react'
import EntryForm from './EntryForm'
import EntryRow from './EntryRow'
import { shekels } from '../lib/format'
import { CATEGORIES, isOverageGood } from '../lib/model'

/**
 * כרטיס קטגוריה גנרי. מקבל category כ-prop ומציג את היעד,
 * את היתרה היורדת בזמן אמת, את השורות ואת טופס ההוספה.
 */
export default function CategoryCard({ category, entries, group, actions, onStopRecurring }) {
  const [adding, setAdding] = useState(false)
  const total = entries.reduce((sum, entry) => sum + (entry.actualAmount || 0), 0)
  const { label, budgetGroup } = CATEGORIES[category]
  const hasTarget = Boolean(group) && group.target > 0
  const exceeded = hasTarget && group.remaining < 0
  const goodToExceed = isOverageGood(budgetGroup)
  const over = exceeded && !goodToExceed
  const progress = hasTarget ? Math.min(100, (group.actual / group.target) * 100) : 0

  return (
    <section className="card category">
      <header className="category-head">
        <h2>{label}</h2>
        <span className="category-total num">{shekels(total)}</span>
      </header>

      {hasTarget && (
        <>
          <div className="target-line">
            <span className="num">יעד {shekels(group.target)}</span>
            <strong className={`num ${over ? 'over' : 'under'}`}>
              {exceeded
                ? `${goodToExceed ? 'מעבר ליעד' : 'חריגה'} ${shekels(Math.abs(group.remaining))}`
                : `נותרו ${shekels(group.remaining)}`}
            </strong>
          </div>
          <div className="bar" role="presentation">
            <div className={`bar-fill ${over ? 'over' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {entries.length > 0 ? (
        <ul className="entry-list">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onUpdate={actions.update}
              onRemove={actions.remove}
              onStopRecurring={onStopRecurring}
            />
          ))}
        </ul>
      ) : (
        <p className="empty">אין עדיין שורות</p>
      )}

      {adding ? (
        <EntryForm
          category={category}
          onSubmit={async (values) => {
            await actions.add(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="secondary" onClick={() => setAdding(true)}>
          + הוספת שורה
        </button>
      )}
    </section>
  )
}

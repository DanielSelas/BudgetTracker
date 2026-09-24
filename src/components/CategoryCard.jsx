import EntryItems from './EntryItems'
import { shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, CATEGORIES, isOverageGood } from '../lib/model'
import { EXPENSE_PILLS } from '../lib/pills'

/**
 * כרטיס קטגוריה.
 *
 * הרקע לבן בכל הקטגוריות, וצבע הקטגוריה מופיע רק בנקודה שליד השם
 * ובפס ההתקדמות. רקע צבעוני לכל כרטיס הפך את המסך לארבעה משטחים
 * שמתחרים על תשומת הלב, ובלעדיו העין הולכת למספרים.
 */
export default function CategoryCard({
  category, entries, group, authorOf, actions, onStopRecurring,
}) {
  const { label, budgetGroup } = CATEGORIES[category]
  const ratio = BUDGET_GROUP_RATIOS[budgetGroup]

  const total = entries.reduce((sum, entry) => sum + (entry.actualAmount || 0), 0)
  // הכנסה אינה קטגוריה של הוצאה, ולכן אין לאן להחליף ממנה
  const editable = category === 'income' ? [] : EXPENSE_PILLS
  const hasTarget = Boolean(group) && group.target > 0
  const exceeded = hasTarget && group.remaining < 0
  const goodToExceed = isOverageGood(budgetGroup)
  const danger = exceeded && !goodToExceed
  // קיזוז יכול להוריד קטגוריה מתחת לאפס, ורוחב שלילי אינו רוחב
  const progress = hasTarget
    ? Math.max(0, Math.min(100, (group.actual / group.target) * 100))
    : 0

  return (
    <section className="cat-card" data-category={category}>
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <h2>{label}</h2>
          {ratio && <span className="pct">{Math.round(ratio * 100)}%</span>}
        </span>

        {/* בהכנסה אין יעד, ולכן מוצג הסכום בלבד */}
        <span className="cat-total num">
          <strong>{shekels(total)}</strong>
          {hasTarget && <span className="of"> / {shekels(group.target)}</span>}
        </span>
      </div>

      {hasTarget && (
        <>
          <div className="bar">
            <div className={`bar-fill ${danger ? 'danger' : ''}`} style={{ width: `${progress}%` }} />
          </div>

          <span className={`cat-state ${danger ? 'danger' : ''} ${exceeded && goodToExceed ? 'good' : ''}`}>
            {exceeded
              ? goodToExceed
                ? <>+{shekels(-group.remaining)} מעל היעד</>
                : <>חריגה {shekels(-group.remaining)}</>
              : <>נותרו {shekels(group.remaining)}</>}
          </span>
        </>
      )}

      {entries.length > 0 ? (
        <EntryItems
          entries={entries}
          authorOf={authorOf}
          actions={actions}
          categories={editable}
          onStopRecurring={onStopRecurring}
        />
      ) : (
        <p className="empty">אין עדיין רשומות</p>
      )}
    </section>
  )
}

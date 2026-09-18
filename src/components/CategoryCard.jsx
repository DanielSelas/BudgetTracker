import EntryItems from './EntryItems'
import { shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, CATEGORIES, isOverageGood } from '../lib/model'
import { EXPENSE_PILLS } from '../lib/pills'

const ADD_LABEL = {
  income: '+ הוספת הכנסה',
  fixed: '+ הוספת הוצאה קבועה',
  leisure: '+ הוספת הוצאה משתנה',
  fund: '+ הפקדה',
}

export default function CategoryCard({ category, entries, group, authorOf, actions, onAdd, onStopRecurring }) {
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
          {ratio && <span className="pct-tag">{Math.round(ratio * 100)}%</span>}
        </span>
        <span className="cat-total num">{shekels(total)}</span>
      </div>

      {hasTarget && (
        <div className="target-block">
          <div className="target-row">
            <span className={`left ${danger ? 'danger' : ''}`}>
              {exceeded
                ? goodToExceed
                  ? <>מעבר ליעד <strong className="num">{shekels(-group.remaining)}</strong>, יפה!</>
                  : <>חריגה <strong className="num">{shekels(-group.remaining)}</strong></>
                : <>נותרו <strong className="num">{shekels(group.remaining)}</strong></>}
            </span>
            <span className="right num">מתוך יעד {shekels(group.target)}</span>
          </div>
          <div className="bar">
            <div className={`bar-fill ${danger ? 'danger' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <EntryItems
          entries={entries}
          authorOf={authorOf}
          actions={actions}
          categories={editable}
          onStopRecurring={onStopRecurring}
          onAddToGroup={(groupKey) => onAdd(category, groupKey)}
        />
      ) : (
        <p className="empty">אין עדיין שורות</p>
      )}

      <button type="button" className="btn-text" onClick={() => onAdd(category)}>
        {ADD_LABEL[category]}
      </button>
    </section>
  )
}

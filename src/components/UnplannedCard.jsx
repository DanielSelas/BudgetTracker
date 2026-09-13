import EntryRow from './EntryRow'
import { shekels } from '../lib/format'

/**
 * בלתם: המרווח הנזיל שלא חולק לקטגוריות, ומשמש רזרבה להוצאות
 * בלתי צפויות. הרזרבה מחושבת (הכנסה פחות בסיס), אבל מה שמוציאים
 * ממנה הן רשומות אמיתיות שמקטינות אותה.
 */
export default function UnplannedCard({ summary, entries = [], authorOf, actions, onAdd, onStopRecurring }) {
  const { reserve, spent, remaining } = summary.unplanned
  const over = remaining < 0
  const progress = reserve > 0 ? Math.min(100, (spent / reserve) * 100) : 0

  return (
    <section className="cat-card" data-category="unplanned">
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <h2>בלתם</h2>
        </span>
        <span className="cat-total num">{shekels(remaining)}</span>
      </div>

      {reserve > 0 ? (
        <div className="target-block">
          <div className="target-row">
            <span className={`left ${over ? 'danger' : ''}`}>
              {over
                ? <>חריגה <strong className="num">{shekels(-remaining)}</strong></>
                : <>נותרו <strong className="num">{shekels(remaining)}</strong></>}
            </span>
            <span className="right num">מתוך רזרבה {shekels(reserve)}</span>
          </div>
          <div className="bar">
            <div className={`bar-fill ${over ? 'danger' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <p className="note">
          המרווח הנזיל שלא חולק לקטגוריות. הוא ייפתח ברגע שתהיה הכנסה.
        </p>
      )}

      {entries.length > 0 ? (
        <ul className="entry-list">
          {entries.map((entry) => (
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
      ) : (
        reserve > 0 && <p className="empty">רזרבה להוצאות בלתי צפויות, כמו תיקון רכב</p>
      )}

      {reserve > 0 && (
        <button type="button" className="btn-text" onClick={() => onAdd('unplanned')}>
          + הוצאה מהרזרבה
        </button>
      )}
    </section>
  )
}

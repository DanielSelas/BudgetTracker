import EntryItems from './EntryItems'
import { shekels } from '../lib/format'
import { CATEGORIES } from '../lib/model'
import { EXPENSE_PILLS } from '../lib/pills'

/**
 * השארית: מה שנכנס מעבר לסכום הבסיס.
 *
 * כשהבסיס נגזר אוטומטית מההכנסה היא רזרבה קטנה להוצאות בלתי צפויות.
 * כשקובעים בסיס קבוע היא יכולה להיות גדולה, וזה בדיוק העניין: היא
 * כסף שלא תוכנן להוצאה, ולכן ההמלצה עליו היא להפקיד ולא לבזבז.
 */
export default function UnplannedCard({
  summary, entries = [], authorOf, actions, onAdd, onDeposit, onStopRecurring,
}) {
  const { reserve, spent, remaining } = summary.unplanned
  const over = remaining < 0
  const progress = reserve > 0 ? Math.min(100, (spent / reserve) * 100) : 0
  // הצעה להפקיד רק כשיש ממש מה להפקיד, ולא על שאריות של שקלים בודדים
  const worthDepositing = summary.usesFixedBase && remaining >= 500

  return (
    <section className="cat-card" data-category="unplanned">
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <h2>{CATEGORIES.unplanned.label}</h2>
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
            <span className="right num">מתוך {shekels(reserve)}</span>
          </div>
          <div className="bar">
            <div className={`bar-fill ${over ? 'danger' : ''}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <p className="note">
          {summary.usesFixedBase
            ? 'מה שייכנס מעבר לסכום הבסיס יופיע כאן.'
            : 'המרווח הנזיל שלא חולק לקטגוריות. הוא ייפתח ברגע שתהיה הכנסה.'}
        </p>
      )}

      {worthDepositing && (
        <button type="button" className="prompt-card" data-category="fund" onClick={() => onDeposit?.(remaining)}>
          <span className="prompt-title">נשארו {shekels(remaining)} מעבר לתוכנית</span>
          <span className="prompt-body">
            זה כסף שלא תוכנן להוצאה החודש. אפשר להשאיר אותו כאן לכל מקרה,
            אבל אם אין לו ייעוד עדיף שילך לקרן.
          </span>
          <span className="prompt-cta">+ הפקדה לקרן</span>
        </button>
      )}

      {entries.length > 0 ? (
        <EntryItems
          entries={entries}
          authorOf={authorOf}
          actions={actions}
          categories={EXPENSE_PILLS}
          onStopRecurring={onStopRecurring}
          onAddToGroup={(groupKey) => onAdd('unplanned', groupKey)}
        />
      ) : (
        reserve > 0 && !worthDepositing && (
          <p className="empty">לדברים שלא תוכננו, כמו תיקון רכב</p>
        )
      )}

      {reserve > 0 && (
        <button type="button" className="btn-text" onClick={() => onAdd('unplanned')}>
          + הוצאה מהשארית
        </button>
      )}
    </section>
  )
}

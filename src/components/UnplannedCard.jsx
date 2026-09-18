import EntryItems from './EntryItems'
import { shekels } from '../lib/format'
import { CATEGORIES } from '../lib/model'
import { EXPENSE_PILLS } from '../lib/pills'

/**
 * היתרה: מה שנכנס מעבר לסכום הבסיס.
 *
 * כשהבסיס נגזר אוטומטית מההכנסה היא קטנה. כשקובעים בסיס קבוע היא
 * יכולה להיות גדולה, וזה בדיוק העניין: היא כסף שלא תוכנן להוצאה,
 * ולכן ההמלצה עליו היא להפקיד ולא לבזבז.
 *
 * הבלת״ם הוא מה שכן יוצא ממנה, ולכן הוא כותרת משנה בתוך הכרטיס ולא
 * כרטיס נפרד: זה אותו כסף, רק בכיוון ההפוך.
 *
 * והבלת״ם קודם להצעת ההפקדה, כי הוא יורד מהיתרה. מפקידים את מה
 * שנשאר אחריו, ולכן ההצעה היא השורה האחרונה ולא הראשונה.
 */
export default function UnplannedCard({
  summary, entries = [], authorOf, actions, onAdd, onDeposit, onStopRecurring,
}) {
  const { reserve, spent, remaining, deposited } = summary.unplanned
  const over = remaining < 0
  const progress = reserve > 0 ? Math.max(0, Math.min(100, (spent / reserve) * 100)) : 0
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

      {reserve > 0 && (
        <div className="subsection">
          <h3>בלת״ם</h3>

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
            <p className="empty">מה שלא תוכנן, כמו תיקון קורקינט</p>
          )}

          <button type="button" className="btn-text" onClick={() => onAdd('unplanned')}>
            + הוצאה בלתי צפויה
          </button>
        </div>
      )}

      {(worthDepositing || deposited > 0) && (
        <div className="subsection">
          <h3>להפקדה</h3>

          {worthDepositing && (
            <button
              type="button"
              className="prompt-card"
              data-category="fund"
              onClick={() => onDeposit?.(remaining)}
            >
              <span className="prompt-title">נשארו {shekels(remaining)} מעבר לתוכנית</span>
              <span className="prompt-body">
                זה כסף שלא תוכנן להוצאה החודש. אפשר להשאיר אותו כאן לכל מקרה,
                אבל אם אין לו ייעוד עדיף להפקיד אותו.
              </span>
              <span className="prompt-cta">+ הפקדה</span>
            </button>
          )}

          {deposited > 0 && (
            <p className="hint">
              מתוך היתרה כבר הופקדו <strong className="num">{shekels(deposited)}</strong>.
            </p>
          )}
        </div>
      )}

    </section>
  )
}

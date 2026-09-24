import EntryItems from './EntryItems'
import { shekels } from '../lib/format'
import { CATEGORIES } from '../lib/model'
import { EXPENSE_PILLS } from '../lib/pills'

/**
 * הבלת״ם: מה שלא חולק לקטגוריות.
 *
 * מסגרת מקווקוות ובלי רקע ובלי צל, כי הוא אינו חלק מהתקציב המחולק
 * אלא מה שנשאר מחוצה לו. זה ההבדל היחיד בינו לבין כרטיס קטגוריה,
 * והוא נאמר בצורה ולא בצבע.
 *
 * הרשימה מוצגת כשיש בה משהו. בחודש מיובא בלי הכנסה הרזרבה היא אפס,
 * ובלי הרשימה הוצאות הבלת״ם היו נעלמות מהמסך למרות שהן נספרות.
 */
export default function UnplannedCard({
  summary, entries = [], authorOf, actions, onDeposit, onStopRecurring,
}) {
  const { reserve, spent, remaining, deposited } = summary.unplanned
  const over = remaining < 0
  // בלי רזרבה אין ממה לספור, ואז מה שהכרטיס מדווח עליו הוא ההוצאה
  const shown = reserve > 0 ? remaining : spent
  const worthDepositing = summary.usesFixedBase && remaining >= 500

  return (
    <section className="cat-card dashed" data-category="unplanned">
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <span className="stack-title">
            <h2>{CATEGORIES.unplanned.short}</h2>
            <span className="cat-sub">
              {reserve > 0
                ? 'רזרבה שלא חולקה לקטגוריות'
                : spent > 0
                  ? 'יצא בלי שתוכנן, ואין רזרבה שתכסה אותו'
                  : 'רזרבה שלא חולקה לקטגוריות'}
            </span>
          </span>
        </span>
        <span className={`cat-total num ${over && reserve > 0 ? 'danger' : ''}`}>
          <strong>{shekels(shown)}</strong>
        </span>
      </div>

      {entries.length > 0 && (
        <EntryItems
          entries={entries}
          authorOf={authorOf}
          actions={actions}
          categories={EXPENSE_PILLS}
          onStopRecurring={onStopRecurring}
        />
      )}

      {worthDepositing && (
        <button type="button" className="deposit-prompt" onClick={() => onDeposit?.(remaining)}>
          <span>נשארו {shekels(remaining)} מעבר לתוכנית. אפשר להפקיד.</span>
        </button>
      )}

      {deposited > 0 && (
        <span className="cat-sub">
          מתוך היתרה כבר הופקדו <strong className="num">{shekels(deposited)}</strong>.
        </span>
      )}
    </section>
  )
}

import { shekels } from '../lib/format'

/**
 * הסיכום של החודש.
 *
 * פס אחד מחלק את ההכנסה לשלושת הקבוצות, והחלק הריק שנשאר בו הוא
 * היתרה. זו התמונה השלמה במבט אחד, ולכן היא למעלה: כמה נשאר, איך
 * הכסף מתחלק, ושלושת המספרים שמתחת.
 */
const SEGMENTS = [
  { group: 'fixed', category: 'fixed' },
  { group: 'leisure', category: 'leisure' },
  { group: 'savings', category: 'fund' },
]

export default function SummaryCard({ summary, onEditBase }) {
  // בלי הכנסה אין בסיס, אין יעדים, ו"יתרה" שלילית היא לא גירעון אלא
  // פשוט חוסר נתונים. עדיף להשהות את החישוב מאשר להציג מספר מטעה.
  const pending = summary.totalIncome === 0

  const segments = SEGMENTS.map(({ group, category }) => ({
    category,
    width: pending
      ? 0
      : Math.max(0, Math.min(100, (summary.groups[group].actual / summary.totalIncome) * 100)),
  })).filter((segment) => segment.width > 0)

  return (
    <section className="summary">
      <div className="summary-hero">
        <span className="cap">נשאר החודש</span>
        {pending ? (
          <span className="amount pending">יחושב אחרי הזנת ההכנסה</span>
        ) : (
          <span className={`amount num ${summary.balance < 0 ? 'negative' : ''}`}>
            {shekels(summary.balance)}
          </span>
        )}
      </div>

      {!pending && (
        <div className="split-bar" aria-hidden="true">
          {segments.map((segment) => (
            <span
              key={segment.category}
              className="split-seg"
              data-category={segment.category}
              style={{ width: `${segment.width}%` }}
            />
          ))}
        </div>
      )}

      <div className="summary-tiles">
        <div>
          <span className="cap">הכנסות</span>
          <span className="val num">{shekels(summary.totalIncome)}</span>
        </div>
        <div>
          <span className="cap">הוצאות</span>
          <span className="val num">{shekels(summary.totalExpenses)}</span>
        </div>
        <div>
          <span className="cap">סכום בסיס</span>
          {/* ניתן לעריכה בכוונה: חודש טוב לא אמור להרשות יותר הוצאות,
              ולכן אפשר לקבע בסיס במקום לגזור אותו מההכנסה */}
          <button type="button" className="val num as-button" onClick={onEditBase}>
            {pending && !summary.usesFixedBase ? 'טרם חושב' : shekels(summary.baseAmount)}
          </button>
        </div>
      </div>
    </section>
  )
}

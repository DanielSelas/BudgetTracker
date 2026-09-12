import { shekels, signedShekels } from '../lib/format'
import { isOverageGood } from '../lib/model'

const GROUP_LABELS = {
  fixed: 'קבועות · 50%',
  leisure: 'פנאי · 30%',
  savings: 'חיסכון · 20%',
}

export default function SummaryCard({ summary }) {
  return (
    <section className="card summary">
      {/* היתרה היא המספר שמסתכלים עליו קודם, ולכן היא לבדה בראש */}
      <div className="summary-hero">
        <span className="label">יתרה החודש</span>
        <span className={`amount num ${summary.balance < 0 ? 'negative' : ''}`}>
          {shekels(summary.balance)}
        </span>
      </div>

      <div className="summary-split">
        <div>
          <span className="label">הכנסות</span>
          <strong className="num">{shekels(summary.totalIncome)}</strong>
        </div>
        <div>
          <span className="label">הוצאות</span>
          <strong className="num">{shekels(summary.totalExpenses)}</strong>
        </div>
      </div>

      <div className="base-line">
        <span>סכום בסיס <strong className="num">{shekels(summary.baseAmount)}</strong></span>
        <span className="hint">מחושב מההכנסה</span>
      </div>

      <ul className="group-list">
        {Object.entries(GROUP_LABELS).map(([group, label]) => {
          const data = summary.groups[group]
          const over = data.deviation > 0 && !isOverageGood(group)
          return (
            <li key={group}>
              <span className="label">{label}</span>
              <span className="values num">
                {shekels(data.actual)} <span className="hint">/ {shekels(data.target)}</span>
              </span>
              <span className={`deviation num ${over ? 'over' : 'under'}`}>
                {signedShekels(data.deviation)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

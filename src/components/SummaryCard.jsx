import { shekels } from '../lib/format'

export default function SummaryCard({ summary }) {
  return (
    <section className="summary">
      <div className="summary-hero">
        <span className="cap">נשאר לכם החודש</span>
        <span className={`amount num ${summary.balance < 0 ? 'negative' : ''}`}>
          {shekels(summary.balance)}
        </span>
      </div>

      <div className="summary-tiles">
        <div>
          <span className="cap">הכנסות</span>
          <span className="val income num">{shekels(summary.totalIncome)}</span>
        </div>
        <div>
          <span className="cap">הוצאות</span>
          <span className="val num">{shekels(summary.totalExpenses)}</span>
        </div>
      </div>

      {/* מוצג בלבד. אין בממשק שום דרך לערוך את הבסיס. */}
      <div className="base-row">
        <span>סכום בסיס <strong className="num">{shekels(summary.baseAmount)}</strong></span>
        <span className="note">מחושב מההכנסה · לא לעריכה</span>
      </div>
    </section>
  )
}

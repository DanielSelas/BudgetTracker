import { monthLabel } from '../lib/format'
import { billingWindow, monthKey, shiftMonth } from '../lib/model'

export default function MonthPicker({ month, onChange, subtitle, billingDay, current }) {
  // "החודש הנוכחי" הוא המחזור שרץ עכשיו, שאינו בהכרח החודש שבלוח
  const now = current || monthKey()
  const isCurrent = month === now
  const window = billingWindow(month, billingDay)

  return (
    <div className="month-picker">
      {/* ציר הזמן זורם ימין לשמאל כמו הטקסט, ולכן אחורה בזמן זה ימינה.
          לא משתמשים ב-‹ › כי הם תווים משוקפי דו-כיווניות ומוצגים הפוך. */}
      <button
        type="button"
        className="btn-round sm"
        aria-label="החודש הקודם"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        →
      </button>

      <button
        type="button"
        className="month-label"
        onClick={() => onChange(now)}
        disabled={isCurrent}
        title={isCurrent ? '' : 'חזרה לחודש הנוכחי'}
      >
        <span className="m">{monthLabel(month)}</span>
        {window && <span className="cycle num">{window}</span>}
        {subtitle && <span className="sub">{subtitle}</span>}
      </button>

      <button
        type="button"
        className="btn-round sm"
        aria-label="החודש הבא"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        ←
      </button>
    </div>
  )
}

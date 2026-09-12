import { monthLabel } from '../lib/format'
import { monthKey, shiftMonth } from '../lib/model'

export default function MonthPicker({ month, onChange, subtitle }) {
  const isCurrent = month === monthKey()

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
        onClick={() => onChange(monthKey())}
        disabled={isCurrent}
        title={isCurrent ? '' : 'חזרה לחודש הנוכחי'}
      >
        <span className="m">{monthLabel(month)}</span>
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

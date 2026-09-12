import { monthLabel } from '../lib/format'
import { monthKey, shiftMonth } from '../lib/model'

export default function MonthPicker({ month, onChange }) {
  const isCurrent = month === monthKey()

  return (
    <div className="month-picker">
      {/* ציר הזמן זורם ימין-לשמאל כמו הטקסט: אחורה בזמן זה ימינה.
          לא משתמשים ב-‹ › כי הם תווים משוקפי-דו-כיווניות ומוצגים
          הפוך ממה שנכתב כאן; ← → אינם משוקפים. */}
      <button
        type="button"
        className="secondary icon"
        aria-label="החודש הקודם"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        →
      </button>

      <button
        type="button"
        className="month-label secondary"
        onClick={() => onChange(monthKey())}
        disabled={isCurrent}
        title={isCurrent ? '' : 'חזרה לחודש הנוכחי'}
      >
        {monthLabel(month)}
      </button>

      <button
        type="button"
        className="secondary icon"
        aria-label="החודש הבא"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        ←
      </button>
    </div>
  )
}

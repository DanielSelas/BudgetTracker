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

      {/* כותרת המסך. בלי h1 ניווט לפי כותרות נחת על הקטגוריה הראשונה
          ודילג על היתרה, שהיא כל הסיבה שהמסך נפתח. הכותרת עוטפת את
          הכפתור ולא יושבת בתוכו, כי צאצאי button הם מצגתיים ותפקיד
          כותרת בתוכם נבלע */}
      <h1 className="month-heading">
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
      </h1>

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

import { monthLabel } from '../lib/format'
import { monthKey, shiftMonth } from '../lib/model'

/**
 * בחירת חודש מתוך רשימה, ולא שדה תאריך.
 *
 * input type="month" אינו נתמך בספארי במחשב ובפיירפוקס, ושם הוא
 * נופל לשדה טקסט חופשי: אין בורר, אין רמז, ומי שרואה אותו פשוט לא
 * יודע מה להקליד. רשימה עובדת בכל מקום, ומציגה את החודש בעברית
 * במקום לדרוש פורמט.
 */
export default function MonthSelect({
  value, onChange, from, months = 36, allowEmpty = false,
  emptyLabel = 'בלי תאריך סיום', id,
}) {
  const start = from || monthKey()
  const options = Array.from({ length: months }, (_, index) => shiftMonth(start, index))

  // חודש ששמור כבר ואינו בטווח חייב להופיע, אחרת הבחירה נמחקת
  // מעצמה ברגע שפותחים את המסך
  if (value && !options.includes(value)) options.unshift(value)

  return (
    <select
      id={id}
      className="input rtl"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((key) => (
        <option key={key} value={key}>{monthLabel(key)}</option>
      ))}
    </select>
  )
}

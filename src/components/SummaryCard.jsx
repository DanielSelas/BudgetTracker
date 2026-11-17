import { shekels } from '../lib/format'
import { planRemaining } from '../lib/model'

/**
 * הסיכום של החודש.
 *
 * פס אחד מחלק את ההכנסה לשלושת הקבוצות, והחלק הריק שנשאר בו הוא
 * היתרה. זו התמונה השלמה במבט אחד, ולכן היא למעלה: כמה נשאר, איך
 * הכסף מתחלק, ושלושת המספרים שמתחת.
 */
const SEGMENTS = [
  { group: 'fixed', category: 'fixed', label: 'קבועות' },
  { group: 'leisure', category: 'leisure', label: 'משתנות' },
  { group: 'savings', category: 'fund', label: 'הפקדות' },
]

export default function SummaryCard({ summary, onEditBase, onShowIncome }) {
  // בלי הכנסה אין בסיס, אין יעדים, ו"יתרה" שלילית היא לא גירעון אלא
  // פשוט חוסר נתונים. עדיף להשהות את החישוב מאשר להציג מספר מטעה.
  const pending = summary.totalIncome === 0

  const segments = SEGMENTS.map(({ group, category, label }) => ({
    category,
    group,
    label,
    width: pending
      ? 0
      : Math.max(0, Math.min(100, (summary.groups[group].actual / summary.totalIncome) * 100)),
  })).filter((segment) => segment.width > 0)

  const barLabel = `חלוקת ההכנסה: ${segments
    .map((segment) => `${segment.label} ${shekels(summary.groups[segment.group].actual)}`)
    .join(', ')}`

  // המספר הגדול הוא מה שנשאר בתוך התוכנית, ולא הכנסות פחות הוצאות:
  // הכנסה מעל הבסיס היא עודף שאמור להופקד, ולא רשות להוציא יותר.
  // חיסור של כל ההוצאות מהבסיס היה שגוי בכיוון השני, כי הוצאות
  // בלת״ם יוצאות מהעודף ולא מהתוכנית, ולכן נחסרות רק שלוש הקבוצות.
  const remaining = planRemaining(summary)
  const extra = summary.unplanned.remaining

  return (
    <section className="summary">
      <div className="summary-hero">
        <span className="cap">נשאר מהתוכנית</span>
        {pending ? (
          <span className="amount pending">יחושב אחרי הזנת ההכנסה</span>
        ) : (
          <span className={`amount num ${remaining < 0 ? 'negative' : ''}`}>
            {shekels(remaining)}
          </span>
        )}
        {/* העודף נאמר כאן ולא נשמר לכרטיס שבתחתית: אחרת הוא נקרא
            כאילו הוא חלק מהמספר הגדול, וזה בדיוק מה שאין לו רשות */}
        {!pending && extra > 0 && (
          <span className="extra">
            ועוד <span className="num">{shekels(extra)}</span> שנכנסו מעבר לתוכנית
          </span>
        )}
      </div>

      {/* הפס היה aria-hidden בלי חלופה, והגוונים שלו הותאמו זה לזה
          במשקל חזותי בכוונה, כך שפלחים סמוכים נבדלים ב-1.03:1. צבע
          לבדו אינו קריא כאן, ולכן יש גם שם נגיש וגם מקרא */}
      {!pending && (
        <>
          <div className="split-bar" role="img" aria-label={barLabel}>
            {segments.map((segment) => (
              <span
                key={segment.category}
                className="split-seg"
                data-category={segment.category}
                style={{ width: `${segment.width}%` }}
              />
            ))}
          </div>

          <ul className="split-legend">
            {segments.map((segment) => (
              <li key={segment.category}>
                <span className="dot" data-category={segment.category} />
                {segment.label}
                <span className="num">{shekels(summary.groups[segment.group].actual)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="summary-tiles">
        <div>
          <span className="cap">הכנסות</span>
          {/* ההכנסות אינן כרטיס במסך, ולכן האריח הזה הוא הדרך היחידה
              להגיע לשורות עצמן ולתקן משכורת שהוקלדה לא נכון */}
          <button type="button" className="val num as-button" onClick={onShowIncome}>
            {shekels(summary.totalIncome)}
          </button>
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

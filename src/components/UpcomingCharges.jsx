import { useState } from 'react'
import { shekels } from '../lib/format'
import { billingWindow } from '../lib/model'

const monthDay = (month, day) => {
  const [, raw] = String(month).split('-').map(Number)
  const next = raw === 12 ? 1 : raw + 1
  return `${day}.${next}`
}

/**
 * מה עומד לרדת, ומתי.
 *
 * זו שאלה אחרת מ"כמה נשאר החודש", ולכן היא כרטיס נפרד. התקציב עונה
 * על האם אנחנו בתוך התוכנית, וזה עונה על האם יהיה מספיק בחשבון ביום
 * החיוב. שתי השאלות התערבבו עד עכשיו לאחת.
 *
 * מכווץ כברירת מחדל: רוב הימים מספיק לראות את השורה התחתונה.
 */
export default function UpcomingCharges({ summary, billingDay, month }) {
  const [open, setOpen] = useState(false)
  if (!billingDay || !summary?.upcoming) return null

  const { card, direct, directRows, income } = summary.upcoming
  if (card <= 0 && direct <= 0) return null

  return (
    <section className="upcoming" data-open={open || undefined}>
      <button
        type="button"
        className="upcoming-head"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="chevron" aria-hidden="true">▾</span>
        <span className="upcoming-title">
          ב־{monthDay(month, billingDay)} ייגבו
        </span>
        <span className="entry-amount num">{shekels(card)}</span>
      </button>

      {open && (
        <div className="upcoming-body">
          <ul className="entry-list">
            <li className="entry-row">
              <span className="entry-name">כל מה שהוזן במחזור</span>
              <span className="recurring-tag as-tag">{billingWindow(month, billingDay)}</span>
              <span className="entry-amount num">{shekels(card)}</span>
            </li>
          </ul>

          {directRows.length > 0 && (
            <div className="subsection">
              <h3>ישירות מהחשבון</h3>
              <p className="hint">בנפרד מחיוב האשראי, כל אחד במועד שלו.</p>
              <ul className="entry-list">
                {directRows.map((entry) => (
                  <li className="entry-row" key={entry.id}>
                    <span className="entry-name">{entry.name}</span>
                    <span className="entry-amount num">{shekels(entry.actualAmount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="upcoming-foot">
            <span>נכנס החודש</span>
            <span className="num">{shekels(income)}</span>
          </div>
          <div className="upcoming-foot total">
            <span>נשאר אחרי הכל</span>
            <span className="num">{shekels(income - card - direct)}</span>
          </div>

          <p className="hint">
            ההנחה היא שכל הוצאה עוברת בכרטיס. היוצאים מן הכלל הם חיובים
            קבועים שסימנתם כיורדים ישירות מהחשבון.
          </p>
        </div>
      )}
    </section>
  )
}

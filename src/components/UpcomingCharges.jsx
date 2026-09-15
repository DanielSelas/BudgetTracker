import { useMemo, useState } from 'react'
import { shekels } from '../lib/format'
import { buildTimeline, formatDay, peakRequirement } from '../lib/upcoming'

/**
 * מה עומד לרדת, מתי, וכמה צריך להיות בחשבון.
 *
 * זו שאלה אחרת מ"כמה נשאר החודש", ולכן היא כרטיס נפרד. אפשר להיות
 * בתוך התוכנית לחלוטין ובכל זאת ליפול ב-2 בחודש, כי הכסף נכנס רק
 * ב-10. התקציב לא רואה את זה, וזה כן.
 *
 * מכווץ כברירת מחדל: רוב הימים מספיקה השורה התחתונה.
 */
export default function UpcomingCharges({ summary, templates, billingDay, onManage }) {
  const [open, setOpen] = useState(false)

  const events = useMemo(
    () => buildTimeline({ templates, cardTotal: summary?.upcoming?.card ?? 0, billingDay }),
    [templates, summary, billingDay],
  )
  const peak = useMemo(() => peakRequirement(events), [events])

  if (events.length === 0) return null

  // בלי מועדים על החיובים אין מה לחשב, ואז עדיף לומר זאת מלהציג אפס
  const dated = events.some((event) => !event.card)

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
          {peak.needed > 0 ? 'צריך בחשבון' : 'החודש הקרוב'}
        </span>
        <span className="entry-amount num">{shekels(peak.needed)}</span>
      </button>

      {open && (
        <div className="upcoming-body">
          <ul className="timeline">
            {events.map((event) => (
              <li className="timeline-row" key={event.id} data-in={event.amount > 0 || undefined}>
                <span className="timeline-day num">{formatDay(event.when)}</span>
                <span className="entry-name">{event.name}</span>
                <span className="entry-amount num">
                  {event.amount > 0 ? '+' : ''}{shekels(event.amount)}
                </span>
              </li>
            ))}
          </ul>

          {peak.at && (
            <div className="upcoming-foot total">
              <span>הנקודה הקשה: {formatDay(peak.at.when)}</span>
              <span className="num">{shekels(peak.needed)}</span>
            </div>
          )}

          {dated ? (
            <p className="hint">
              זה מה שצריך להיות בחשבון עכשיו כדי לעבור את כל האירועים עד
              הכנסה שמכסה אותם.
            </p>
          ) : (
            <>
              <p className="hint">
                בציר יש רק את חיוב האשראי. משכורת והוצאה שיורדת ישירות
                מהחשבון נכנסות אליו רק כשהן מוגדרות כחיוב קבוע עם תאריך,
                ואז אפשר לדעת כמה צריך להחזיק ועד מתי.
              </p>
              {onManage && (
                <button type="button" className="btn-text" onClick={onManage}>
                  הגדרת חיובים קבועים
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

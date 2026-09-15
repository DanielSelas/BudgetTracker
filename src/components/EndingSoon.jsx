import { shekels, monthLabel } from '../lib/format'

/**
 * התחייבויות שנגמרות עכשיו או בחודש הבא.
 *
 * בלי זה חיוב קבוע פשוט מפסיק להופיע יום אחד, ואי אפשר לדעת אם הוא
 * נגמר כמתוכנן או שמשהו נשבר. וזה גם בדיוק הרגע שבו מחדשים שכירות
 * או ביטוח, כלומר הרגע שבו התזכורת שווה משהו.
 */
export default function EndingSoon({ items = [] }) {
  if (items.length === 0) return null

  return (
    <section className="ending-card">
      <h2>{items.length === 1 ? 'התחייבות שמסתיימת' : 'התחייבויות שמסתיימות'}</h2>

      <ul className="entry-list">
        {items.map((item) => (
          <li className="entry-row" key={item.id}>
            <span className="entry-name">{item.name}</span>
            <span className="recurring-tag as-tag">
              {item.endsThisMonth ? 'אחרון החודש' : `אחרון ב${monthLabel(item.endMonth)}`}
            </span>
            <span className="entry-amount num">{shekels(item.actualAmount)}</span>
          </li>
        ))}
      </ul>

      <p className="hint">
        אחרי החודש האחרון הם יפסיקו להיווצר מעצמם. אם חידשתם, עדכנו את
        הסכום ואת התאריך.
      </p>
    </section>
  )
}

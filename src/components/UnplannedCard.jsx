import { shekels } from '../lib/format'

/**
 * בלתם: המרווח הנזיל שנשאר בעו"ש ולא חולק לקטגוריות.
 * קטגוריית תצוגה בלבד, אין לה שורות ואין מה להזין בה.
 */
export default function UnplannedCard({ summary }) {
  return (
    <section className="cat-card unplanned">
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <h2>בלתם</h2>
        </span>
        <span className="cat-total num">{shekels(summary.unplanned)}</span>
      </div>
      <p className="note">
        המרווח הנזיל שלא חולק לקטגוריות. רזרבה לתיקון פתאומי, ומה שנשאר ממנו יכול ללכת לקרן.
      </p>
    </section>
  )
}

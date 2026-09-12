import { shekels } from '../lib/format'

/**
 * "בלת"ם", המרווח הנזיל שנשאר בעו"ש ולא חולק לקטגוריות.
 * קטגוריית תצוגה בלבד: אין לה שורות ואין מה להזין בה.
 */
export default function UnplannedCard({ summary }) {
  return (
    <section className="card unplanned">
      <header className="category-head">
        <h2>בלת"ם</h2>
        <span className="category-total num">{shekels(summary.unplanned)}</span>
      </header>
      <p className="hint">
        הכנסה {shekels(summary.totalIncome)} פחות בסיס {shekels(summary.baseAmount)}.
        רזרבה להוצאות בלתי צפויות, או מקור להפקדה נוספת לקרן.
      </p>
    </section>
  )
}

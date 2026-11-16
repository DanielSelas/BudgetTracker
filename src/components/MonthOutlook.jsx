import { shekels } from '../lib/format'
import { CATEGORIES } from '../lib/model'

const GROUP_LABEL = {
  fixed: CATEGORIES.fixed.label,
  leisure: CATEGORIES.leisure.label,
  savings: CATEGORIES.fund.label,
}

/**
 * אזהרה באמצע החודש, כשכבר אפשר לומר בוודאות שהוא לא יחזיק.
 *
 * זה לא MonthVerdict בזמן אחר. הסיכום מספר איך נגמר חודש שנסגר,
 * וזה אומר מה עוד אפשר לעשות בחודש שרץ, ולכן הזמן הוא עתיד ולא
 * עבר ויש בו מה לעשות ולא רק מה לדעת.
 */
export default function MonthOutlook({ outlook }) {
  if (!outlook) return null

  const severe = outlook.level === 'income'
  // משפט בפני עצמו ולא זנב: "יותר ממה שנכנס הכי הרבה בקבועות"
  // נקרא כמשפט אחד מעוות
  const where = outlook.worst
    ? `, והחריגה הגדולה ביותר היא ב${GROUP_LABEL[outlook.worst.group] || outlook.worst.group}`
    : ''

  return (
    <section className="verdict" data-over={severe ? '' : undefined} role="status">
      <h2>{severe ? 'החודש לא יחזיק' : 'התוכנית נשברה'}</h2>

      {severe ? (
        <p className="verdict-lead">
          כבר יצא <strong className="num">{shekels(outlook.gap)}</strong> יותר
          ממה שנכנס{where}. הוצאות רק נוספות, ולכן זה כבר לא יתהפך:
          מכאן והלאה החודש יורד מהחיסכון.
        </p>
      ) : (
        <p className="verdict-lead">
          עברתם את סכום הבסיס ב-<strong className="num">{shekels(outlook.gap)}</strong>{where}.
          ההכנסה עדיין מכסה, אבל זה בא מהעודף שהיה אמור להיות מופקד.
        </p>
      )}
    </section>
  )
}

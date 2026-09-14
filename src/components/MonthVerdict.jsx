import { shekels } from '../lib/format'
import { CATEGORIES, incomeOverage, overspentGroups } from '../lib/model'

const GROUP_LABEL = {
  fixed: CATEGORIES.fixed.label,
  leisure: CATEGORIES.leisure.label,
  savings: CATEGORIES.fund.label,
}

/**
 * איך נגמר החודש. מופיע רק בחודשים שכבר נסגרו, כי באמצע החודש
 * "חרגתם" הוא לא ממצא אלא רק נקודת זמן.
 *
 * שני ספים שונים בכוונה: חריגה מההכנסות פירושה שהחודש אכל מהחיסכון,
 * וחריגה מיעד קטגוריה פירושה שהתוכנית נשברה. הראשון חמור יותר.
 */
export default function MonthVerdict({ summary }) {
  const over = incomeOverage(summary)
  const groups = overspentGroups(summary)

  if (!over && groups.length === 0) return null

  return (
    <section className="verdict" data-over={over ? '' : undefined}>
      <h2>{over ? 'החודש נגמר בחריגה' : 'החודש נגמר מעל התוכנית'}</h2>

      {over ? (
        <p className="verdict-lead">
          הוצאתם <strong className="num">{shekels(over.gap)}</strong> יותר
          ממה שנכנס, כלומר החודש הזה אכל מהחיסכון.
        </p>
      ) : (
        <p className="verdict-lead">
          נשארתם בתוך ההכנסות, אבל חרגתם מהיעדים שקבעתם.
        </p>
      )}

      {groups.length > 0 && (
        <ul className="entry-list">
          {groups.map(({ group, over: amount, target }) => (
            <li className="entry-row" key={group}>
              <span className="entry-name">{GROUP_LABEL[group] || group}</span>
              <span className="recurring-tag as-tag">מתוך {shekels(target)}</span>
              <span className="entry-amount num danger">+{shekels(amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

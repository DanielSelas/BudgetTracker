import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import MonthSelect from './MonthSelect'
import { monthLabel, shekels } from '../lib/format'
import { buildCapacity, planFor } from '../lib/capacity'

/**
 * כמה כסף באמת פנוי, החודש ובחודשים שאחריו.
 *
 * כל מספר כאן ניתן להצבעה: שכירות, הלוואה שנגמרת בינואר, תשלומים
 * שנותרו. אין כאן תחזית, יש כאן חיבור וחיסור של מה שידוע.
 *
 * וזה קו ולא מספר, כי ההתחייבויות נגמרות בתאריכים ידועים והמרווח
 * קופץ. בלי להסתכל קדימה אי אפשר לראות את זה.
 */
export default function Capacity({ entries = [], templates = [], month, onClose }) {
  const [amount, setAmount] = useState('')
  const [target, setTarget] = useState('')
  const [open, setOpen] = useState('')

  const { line, typical } = useMemo(
    () => buildCapacity({ entries, templates, now: month }),
    [entries, templates, month],
  )
  const plan = useMemo(() => planFor(line, amount, target), [line, amount, target])

  const first = line[0]
  const noIncome = first && first.incomeSource === 'none'

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form">
        <h2>כמה פנוי לי</h2>

        {noIncome ? (
          <p className="notice block">
            אין עדיין הכנסה שאפשר לחשב ממנה. הזינו הכנסה, או הגדירו
            אותה כחיוב קבוע חוזר, וכל השאר ייבנה מעצמו.
          </p>
        ) : (
          <>
            <div className="capacity-head">
              <span className="capacity-label">פנוי החודש</span>
              <span className="entry-amount num big">{shekels(first.available)}</span>
            </div>

            <ul className="capacity-breakdown">
              <li>
                <span>הכנסה {first.incomeSource === 'recurring' ? 'קבועה' : 'לפי החודש הנמוך'}</span>
                <span className="num">{shekels(first.income)}</span>
              </li>
              <li className="out">
                <span>חיובים קבועים</span>
                <span className="num">{shekels(-first.commitments)}</span>
              </li>
              {first.installments > 0 && (
                <li className="out">
                  <span>תשלומים שנותרו</span>
                  <span className="num">{shekels(-first.installments)}</span>
                </li>
              )}
              <li className="out">
                <span>חודש רגיל {typical.months > 0 ? `(חציון ${typical.months} חודשים)` : ''}</span>
                <span className="num">{shekels(-typical.amount)}</span>
              </li>
            </ul>

            {typical.months === 0 && (
              <p className="hint">
                עוד אין מספיק חודשים כדי לדעת כמה עולה חודש רגיל, ולכן
                המספר למעלה הוא המרווח לפני הוצאות שוטפות.
              </p>
            )}

            <h3>החודשים הקרובים</h3>
            <ul className="capacity-line">
              {line.map((item) => (
                <li key={item.month}>
                  <button
                    type="button"
                    className="capacity-month"
                    aria-expanded={open === item.month}
                    onClick={() => setOpen((current) => (current === item.month ? '' : item.month))}
                  >
                    <span className="entry-name">{monthLabel(item.month)}</span>
                    {item.ending.length > 0 && (
                      <span className="recurring-tag as-tag">
                        {`נגמר: ${item.ending.join(', ')}`}
                      </span>
                    )}
                    <span className="entry-amount num">{shekels(item.available)}</span>
                  </button>

                  {open === item.month && (
                    <ul className="capacity-breakdown inner">
                      {item.items.map((commitment) => (
                        <li className="out" key={commitment.id}>
                          <span>{commitment.name}</span>
                          <span className="num">{shekels(-commitment.amount)}</span>
                        </li>
                      ))}
                      {item.installments > 0 && (
                        <li className="out">
                          <span>תשלומים</span>
                          <span className="num">{shekels(-item.installments)}</span>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <h3>אני רוצה להוציא</h3>
            <label className="field">
              כמה
              <input
                className="input num" type="number" inputMode="decimal" min="0" step="100"
                placeholder="למשל 20000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label className="field">
              מתי
              <MonthSelect
                value={target} onChange={setTarget} from={month} allowEmpty
                emptyLabel="בלי תאריך" label="חודש היעד"
              />
            </label>

            {plan && (
              <div className="notice block">
                {plan.readyAt ? (
                  <p>
                    בקצב הנוכחי הסכום מצטבר עד <strong>{monthLabel(plan.readyAt)}</strong>.
                  </p>
                ) : (
                  <p>
                    בקצב הנוכחי הסכום לא מצטבר בשנה הקרובה.
                  </p>
                )}

                {target && (
                  plan.reachesTarget ? (
                    <p>
                      עד {monthLabel(target)} יצטברו <strong>{shekels(plan.untilTarget)}</strong>,
                      וזה מספיק. ההפרשה הנדרשת היא {shekels(plan.perMonth)} לחודש.
                    </p>
                  ) : (
                    <p>
                      עד {monthLabel(target)} יצטברו <strong>{shekels(plan.untilTarget)}</strong>,
                      כלומר חסרים <strong>{shekels(plan.shortfall)}</strong>. כדי להספיק צריך
                      להפריש {shekels(plan.perMonth)} לחודש, שזה יותר ממה שפנוי.
                    </p>
                  )
                )}

                <p className="hint">
                  זה לא אומר כן או לא. זה אומר מה זה עולה, וההחלטה שלכם.
                  המספרים מניחים שחודש רגיל נשאר רגיל.
                </p>
              </div>
            )}
          </>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </Sheet>
  )
}

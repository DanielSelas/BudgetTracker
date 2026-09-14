import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { MAX_GROUP_LENGTH, SUGGESTED_GROUPS, normalizeGroup } from '../lib/groups'
import { EXPENSE_PILLS, GOAL_PILLS, TRIP_PILLS } from '../lib/pills'
import { CATEGORIES, calcBaseAmount, groupTarget, todayDate } from '../lib/model'

// התאריך של שורת מסגרת קובע לאיזה חודש היא נזקפת בתקציב הבית,
// ולכן שתי המגירות שומרות אותו ולא רק זו של הטיול.
const FRAME_LABEL = Object.fromEntries(
  [...TRIP_PILLS, ...GOAL_PILLS].map((pill) => [pill.category, pill.label]),
)

const DEFAULT_NAME = {
  income: 'הכנסה',
  fixed: 'הוצאה קבועה',
  leisure: 'הוצאת פנאי',
  fund: 'הפקדה לקרן',
  unplanned: 'הוצאה בלתי צפויה',
  deposit: 'הפקדה',
  withdrawal: 'משיכה',
}

const AMOUNT_LABEL = {
  income: 'כמה נכנס?',
  fixed: 'כמה יצא?',
  leisure: 'כמה יצא?',
  fund: 'כמה הפקדתם?',
  unplanned: 'כמה יצא?',
}

/**
 * מגירה תחתונה להזנה מהירה. הסכום ראשון, כי הוא הדבר היחיד שחייב להיות מדויק.
 */
export default function EntrySheet({
  mode = 'month',
  initialCategory = 'fixed',
  initialGroup = '',
  initialAmount = 0,
  groups = [],
  summary,
  me,
  partner,
  onSubmit,
  onClose,
}) {
  const trip = mode === 'trip'
  const goal = mode === 'goal'
  const frame = trip || goal
  // נקבע בפתיחה ולא משתנה, אחרת החלפת קטגוריה הייתה מחליפה את סוג הפעולה
  const [incomeMode] = useState(() => !frame && initialCategory === 'income')
  const [category, setCategory] = useState(initialCategory)
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [name, setName] = useState('')
  const [planned, setPlanned] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [group, setGroup] = useState(initialGroup)
  const [date, setDate] = useState(todayDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setCategory(initialCategory), [initialCategory])

  const value = Number(amount) || 0

  // התצוגה המקדימה היא מה שהופך את הטופס לשימושי: רואים את ההשפעה לפני השמירה
  const impact = useMemo(() => {
    if (!summary) return null

    if (goal) {
      if (summary.target <= 0) return 'לא הוגדר סכום יעד למטרה הזו.'
      const sign = category === 'withdrawal' ? -1 : 1
      const saved = summary.saved + value * sign
      const left = summary.target - saved
      return left > 0
        ? `אחרי זה ייחסכו ${shekels(saved)}, ויישארו ${shekels(left)} עד היעד.`
        : `אחרי זה ייחסכו ${shekels(saved)}, כלומר היעד הושג.`
    }

    if (trip) {
      if (summary.frame <= 0) return 'לא הוגדרה מסגרת לטיול הזה.'
      const left = summary.remaining - value
      return left >= 0
        ? `אחרי זה יישארו ${shekels(left)} מתוך ${shekels(summary.frame)}.`
        : `אחרי זה תהיה חריגה של ${shekels(-left)} מהמסגרת.`
    }

    if (category === 'income') {
      const nextBase = calcBaseAmount(summary.totalIncome + value)
      return `אחרי ההכנסה הזו סכום הבסיס יהיה ${shekels(nextBase)}.`
    }
    if (category === 'unplanned') {
      const { reserve, remaining } = summary.unplanned
      if (reserve <= 0) return 'עדיין לא הוזנה הכנסה, ולכן אין רזרבה החודש.'
      const left = remaining - value
      return left >= 0
        ? `אחרי זה תישאר רזרבה של ${shekels(left)} מתוך ${shekels(reserve)}.`
        : `אחרי זה תהיה חריגה של ${shekels(-left)} מעבר לרזרבה.`
    }

    const { budgetGroup, label } = CATEGORIES[category]
    const target = groupTarget(summary.baseAmount, budgetGroup)
    if (target <= 0) return 'עדיין לא הוזנה הכנסה, ולכן אין יעד לחודש הזה.'
    const left = target - summary.groups[budgetGroup].actual - value
    return left >= 0
      ? `אחרי זה יישארו ב${label} ${shekels(left)} מתוך ${shekels(target)}.`
      : `אחרי זה תהיה חריגה של ${shekels(-left)} מעבר ליעד ${shekels(target)}.`
  }, [summary, category, value, trip, goal])

  async function handleSubmit(event) {
    event.preventDefault()
    if (value <= 0) {
      setError('צריך סכום גדול מאפס')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit(frame
        ? { category, name: name.trim() || FRAME_LABEL[category], actualAmount: value, date }
        : {
            category,
            name: name.trim() || DEFAULT_NAME[category],
            actualAmount: value,
            plannedAmount: Number(planned) || 0,
            recurring,
            groupKey: normalizeGroup(group),
          })
      onClose()
    } catch {
      setError('השמירה נכשלה. נסו שוב')
      setBusy(false)
    }
  }

  const isIncome = category === 'income'
  // ההצעות הקבועות נעלמות ברגע שיש קבוצות אמיתיות, אחרת הן היו רעש
  const chips = groups.length > 0 ? groups : SUGGESTED_GROUPS

  return (
    <Sheet onClose={onClose}>
      <form className="sheet-form" onSubmit={handleSubmit}>
        <h2>
          {goal
            ? (category === 'withdrawal' ? 'משיכה חדשה' : 'הפקדה חדשה')
            : isIncome ? 'הכנסה חדשה' : 'הוצאה חדשה'}
        </h2>

        {!incomeMode && (
        <div className="cat-pills">
          {(goal ? GOAL_PILLS : trip ? TRIP_PILLS : EXPENSE_PILLS).map((pill) => (
            <button
              key={pill.category}
              type="button"
              className="cat-pill"
              data-category={pill.category}
              aria-pressed={category === pill.category}
              onClick={() => setCategory(pill.category)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        )}

        <label className="amount-card">
          <span className="cap">
            {goal
              ? (category === 'withdrawal' ? 'כמה נמשך?' : 'כמה הפקדתם?')
              : trip ? 'כמה יצא?' : AMOUNT_LABEL[category]}
          </span>
          <input
            className="amount-input num"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="₪0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>

        <div className="stack">
          <input
            className="input"
            maxLength={100}
            placeholder={goal ? 'על מה (לא חובה)' : isIncome ? 'מקור ההכנסה' : 'על מה'}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          {!frame && !isIncome && (
            <div className="group-field">
              <div className="group-chips">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="cat-pill"
                    aria-pressed={group === chip}
                    onClick={() => setGroup((current) => (current === chip ? '' : chip))}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                className="input"
                maxLength={MAX_GROUP_LENGTH}
                placeholder="קיבוץ תחת שם (לא חובה)"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              />
              <span className="type-hint">
                שורות עם אותו שם יוצגו מכווצות כשורה אחת עם הסכום המצטבר.
              </span>
            </div>
          )}

          {frame ? (
            <label className="field">
              תאריך
              <input
                className="input ltr"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <span className="type-hint">
                קובע לאיזה חודש השורה תשויך בתקציב הבית.
              </span>
            </label>
          ) : (
          <div className="sheet-row">
            <label className="planned-field">
              <span>מתוכנן</span>
              <input
                className="num"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="0"
                value={planned}
                onChange={(event) => setPlanned(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="recur-toggle"
              aria-pressed={recurring}
              onClick={() => setRecurring((on) => !on)}
            >
              חוזר כל חודש
              <span className="switch"><span className="knob" /></span>
            </button>
          </div>
          )}
        </div>

        {me && (
          <div className="attribution">
            <Avatar member={me.member} index={me.index} size="md" />
            נרשם על שמך{partner ? ` · ${partner} יראה את זה מיד` : ''}
          </div>
        )}

        {impact && <div className="impact">{impact}</div>}
        {error && <p className="notice block" role="alert">{error}</p>}

        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Sheet>
  )
}

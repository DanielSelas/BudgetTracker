import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { CATEGORIES, TRIP_CATEGORIES, TRIP_ORDER, calcBaseAmount, groupTarget, todayDate } from '../lib/model'

/**
 * הכנסה והוצאה הן שתי פעולות שונות, ולכן המגירה לא מערבבת ביניהן.
 * מי שפתח "הוצאה" לא יכול לגלוש להכנסה בטעות, ולהפך.
 */
const EXPENSE_PILLS = [
  { category: 'fixed', label: 'קבועה' },
  { category: 'leisure', label: 'פנאי' },
  { category: 'fund', label: 'קרן' },
  { category: 'unplanned', label: 'בלתם' },
]

const TRIP_PILLS = TRIP_ORDER.map((category) => ({
  category,
  label: TRIP_CATEGORIES[category].label,
}))

const DEFAULT_NAME = {
  income: 'הכנסה',
  fixed: 'הוצאה קבועה',
  leisure: 'הוצאת פנאי',
  fund: 'הפקדה לקרן',
  unplanned: 'הוצאה בלתי צפויה',
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
  initialAmount = 0,
  summary,
  me,
  partner,
  onSubmit,
  onClose,
}) {
  const trip = mode === 'trip'
  // נקבע בפתיחה ולא משתנה, אחרת החלפת קטגוריה הייתה מחליפה את סוג הפעולה
  const [incomeMode] = useState(() => !trip && initialCategory === 'income')
  const [category, setCategory] = useState(initialCategory)
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [name, setName] = useState('')
  const [planned, setPlanned] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [date, setDate] = useState(todayDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setCategory(initialCategory), [initialCategory])

  const value = Number(amount) || 0

  // התצוגה המקדימה היא מה שהופך את הטופס לשימושי: רואים את ההשפעה לפני השמירה
  const impact = useMemo(() => {
    if (!summary) return null

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
  }, [summary, category, value, trip])

  async function handleSubmit(event) {
    event.preventDefault()
    if (value <= 0) {
      setError('צריך סכום גדול מאפס')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit(trip
        ? { category, name: name.trim() || TRIP_CATEGORIES[category].label, actualAmount: value, date }
        : {
            category,
            name: name.trim() || DEFAULT_NAME[category],
            actualAmount: value,
            plannedAmount: Number(planned) || 0,
            recurring,
          })
      onClose()
    } catch {
      setError('השמירה נכשלה. נסו שוב')
      setBusy(false)
    }
  }

  const isIncome = category === 'income'

  return (
    <Sheet onClose={onClose}>
      <form className="sheet-form" onSubmit={handleSubmit}>
        <h2>{isIncome ? 'הכנסה חדשה' : 'הוצאה חדשה'}</h2>

        {!incomeMode && (
        <div className="cat-pills">
          {(trip ? TRIP_PILLS : EXPENSE_PILLS).map((pill) => (
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
          <span className="cap">{trip ? 'כמה יצא?' : AMOUNT_LABEL[category]}</span>
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
            placeholder={isIncome ? 'מקור ההכנסה' : 'על מה'}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          {trip ? (
            <label className="field">
              תאריך
              <input
                className="input ltr"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <span className="type-hint">
                קובע לאיזה חודש ההוצאה תשויך בתקציב הבית.
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

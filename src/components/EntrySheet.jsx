import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { CATEGORIES, calcBaseAmount, groupTarget } from '../lib/model'

/**
 * הכנסה והוצאה הן שתי פעולות שונות, ולכן המגירה לא מערבבת ביניהן.
 * מי שפתח "הוצאה" לא יכול לגלוש להכנסה בטעות, ולהפך.
 */
const EXPENSE_PILLS = [
  { category: 'fixed', label: 'קבועה' },
  { category: 'leisure', label: 'פנאי' },
  { category: 'fund', label: 'קרן' },
]

const DEFAULT_NAME = {
  income: 'הכנסה',
  fixed: 'הוצאה קבועה',
  leisure: 'הוצאת פנאי',
  fund: 'הפקדה לקרן',
}

const AMOUNT_LABEL = {
  income: 'כמה נכנס?',
  fixed: 'כמה יצא?',
  leisure: 'כמה יצא?',
  fund: 'כמה הפקדתם?',
}

/**
 * מגירה תחתונה להזנה מהירה. הסכום ראשון, כי הוא הדבר היחיד שחייב להיות מדויק.
 */
export default function EntrySheet({
  initialCategory = 'fixed',
  initialAmount = 0,
  summary,
  me,
  partner,
  onSubmit,
  onClose,
}) {
  // נקבע בפתיחה ולא משתנה, אחרת החלפת קטגוריה הייתה מחליפה את סוג הפעולה
  const [incomeMode] = useState(() => initialCategory === 'income')
  const [category, setCategory] = useState(initialCategory)
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '')
  const [name, setName] = useState('')
  const [planned, setPlanned] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setCategory(initialCategory), [initialCategory])

  const value = Number(amount) || 0

  // התצוגה המקדימה היא מה שהופך את הטופס לשימושי: רואים את ההשפעה לפני השמירה
  const impact = useMemo(() => {
    if (!summary) return null
    if (category === 'income') {
      const nextBase = calcBaseAmount(summary.totalIncome + value)
      return `אחרי ההכנסה הזו סכום הבסיס יהיה ${shekels(nextBase)}.`
    }
    const { budgetGroup, label } = CATEGORIES[category]
    const target = groupTarget(summary.baseAmount, budgetGroup)
    if (target <= 0) return 'עדיין לא הוזנה הכנסה, ולכן אין יעד לחודש הזה.'
    const left = target - summary.groups[budgetGroup].actual - value
    return left >= 0
      ? `אחרי זה יישארו ב${label} ${shekels(left)} מתוך ${shekels(target)}.`
      : `אחרי זה תהיה חריגה של ${shekels(-left)} מעבר ליעד ${shekels(target)}.`
  }, [summary, category, value])

  async function handleSubmit(event) {
    event.preventDefault()
    if (value <= 0) {
      setError('צריך סכום גדול מאפס')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit({
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
          {EXPENSE_PILLS.map((pill) => (
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
          <span className="cap">{AMOUNT_LABEL[category]}</span>
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

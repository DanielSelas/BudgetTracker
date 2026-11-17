import { useState } from 'react'
import { monthLabel, shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, CATEGORIES, groupTarget } from '../lib/model'

const PREVIEW = [
  { group: 'fixed', label: CATEGORIES.fixed.label },
  { group: 'leisure', label: CATEGORIES.leisure.label },
  { group: 'savings', label: CATEGORIES.fund.label },
]

const toPercents = (ratios) => Object.fromEntries(
  PREVIEW.map(({ group }) => [group, String(Math.round((ratios?.[group] ?? 0) * 100))]),
)

/**
 * קביעת סכום הבסיס והחלוקה שלו.
 *
 * התצוגה המקדימה כאן היא העיקר: הבסיס הוא מספר מופשט, והיעדים
 * שנגזרים ממנו הם מה שבאמת מרגישים. האחוזים ניתנים לעריכה כי
 * 50/30/20 הוא כלל אצבע ולא חוק, ומי שההוצאות שלו לא מתנהגות לפיו
 * צריך להזיז את הקו ולא להתווכח עם היעד בכל חודש.
 */
export default function BaseAmountDialog({ value, ratios, appliesFrom = '', onSave, onCancel }) {
  const [amount, setAmount] = useState(value ? String(value) : '')
  const [percents, setPercents] = useState(() => toPercents(ratios || BUDGET_GROUP_RATIOS))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const base = Number(amount) || 0
  const numbers = PREVIEW.map(({ group }) => Number(percents[group]))
  const valid = numbers.every((number) => Number.isFinite(number) && number >= 0)
  const sum = valid ? numbers.reduce((total, number) => total + number, 0) : 0
  // 100 בדיוק, כי סכום אחר או מחלק כסף שאינו קיים או משאיר כסף בלי בית
  const balanced = valid && sum === 100
  const split = Object.fromEntries(
    PREVIEW.map(({ group }) => [group, (Number(percents[group]) || 0) / 100]),
  )

  async function submit(event) {
    event.preventDefault()
    if (!balanced) return
    setBusy(true)
    try {
      await onSave(base, split)
    } catch {
      setError('השמירה נכשלה')
      setBusy(false)
    }
  }

  return (
    <div
      className="sheet-backdrop middle"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}
    >
      <form className="dialog" role="dialog" aria-modal="true" onSubmit={submit}>
        <h2>סכום הבסיס</h2>
        <p>
          הסכום שאתם מתכננים לחלק כל חודש, ואיך הוא מתחלק. מה שייכנס מעבר
          לו יופיע כיתרה, עם הצעה להפקיד אותו.
        </p>

        <label className="field">
          סכום לחודש
          <input
            className="input num" type="number" inputMode="decimal" min="0" step="500"
            placeholder="אוטומטי לפי ההכנסה"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>

        {/* האחוזים והסכומים באותה שורה: שינוי של אחוז נקרא מיד
            בשקלים, שזו השפה שבה באמת מחליטים */}
        <ul className="entry-list">
          {PREVIEW.map(({ group, label }) => (
            <li className="entry-row" key={group}>
              <span className="entry-name">{label}</span>
              <input
                className="input num ratio-input"
                type="number" inputMode="numeric" min="0" max="100" step="1"
                aria-label={`אחוז ל${label}`}
                value={percents[group]}
                onChange={(event) =>
                  setPercents({ ...percents, [group]: event.target.value })}
              />
              <span className="row-unit">%</span>
              <span className="entry-amount num">
                {base > 0 ? shekels(groupTarget(base, group, split)) : ''}
              </span>
            </li>
          ))}
        </ul>

        <p className={`hint ${balanced ? '' : 'warn'}`} role={balanced ? undefined : 'alert'}>
          {balanced
            ? 'הסכום 100%.'
            : `שלושת האחוזים צריכים להסתכם ב-100%, וכרגע הם ${valid ? sum : 0}%.`}
        </p>

        {base <= 0 && (
          <p className="hint">ריק או אפס מחזיר לגזירה אוטומטית מההכנסה של כל חודש.</p>
        )}

        {/* חודש שעבר סגור, ולכן שינוי שנעשה עכשיו אינו נוגע בו */}
        <p className="hint">
          {appliesFrom
            ? `השינוי יחול מ${monthLabel(appliesFrom)} והלאה. חודשים שכבר עברו נשארים כפי שהיו.`
            : 'השינוי יחול מהחודש הזה והלאה. חודשים שכבר עברו נשארים כפי שהיו.'}
        </p>

        {error && <p className="notice block" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={busy || !balanced}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </form>
    </div>
  )
}

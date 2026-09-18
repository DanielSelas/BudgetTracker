import { useState } from 'react'
import Sheet from './Sheet'
import MonthSelect from './MonthSelect'
import { shekels, monthLabel } from '../lib/format'
import { CATEGORIES, intervalLabel, shiftMonth } from '../lib/model'
import { isEnded, updateTemplate } from '../lib/recurring'

/**
 * כל ההתחייבויות הקבועות במקום אחד.
 *
 * עד עכשיו תבנית נוצרה מתוך מגירת ההזנה ואי אפשר היה לגעת בה שוב:
 * לא לשנות סכום כששכירות עולה, לא להוסיף תאריך, ולא להגדיר סיום.
 * הדרך היחידה הייתה להפסיק וליצור מחדש, ובדרך לאבד את הקשר להיסטוריה.
 */
function Row({ budgetId, template, onStop }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(template.actualAmount ?? 0))
  const [dueDay, setDueDay] = useState(String(template.dueDay || ''))
  const [offCard, setOffCard] = useState(Boolean(template.offCard))
  const [startMonth, setStartMonth] = useState(template.startMonth || '')
  const [endMonth, setEndMonth] = useState(template.endMonth || '')
  const [everyMonths, setEveryMonths] = useState(String(template.everyMonths || 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const income = template.category === 'income'

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateTemplate(budgetId, template.id, {
        actualAmount: Number(amount) || 0,
        offCard: !income && offCard,
        dueDay: (income || offCard) ? Number(dueDay) || 0 : 0,
        everyMonths: Number(everyMonths) || 1,
        startMonth,
        endMonth,
      })
      setOpen(false)
    } catch {
      setError('השמירה נכשלה')
    }
    setBusy(false)
  }

  const badge = income
    ? (template.dueDay ? `נכנס ב־${template.dueDay}` : 'הכנסה')
    : template.offCard
      ? (template.dueDay ? `יורד ב־${template.dueDay}` : 'ישירות מהחשבון')
      : 'בכרטיס'

  return (
    <li className="entry-row commitment" data-open={open || undefined}>
      <button type="button" className="commitment-head" onClick={() => setOpen((on) => !on)}>
        <span className="chevron" aria-hidden="true">▾</span>
        <span className="entry-name">{template.name}</span>
        <span className="recurring-tag as-tag">{badge}</span>
        <span className="entry-amount num">{shekels(template.actualAmount)}</span>
      </button>

      {!open && (template.endMonth || template.everyMonths > 1) && (
        <span className="type-hint">
          {[
            template.everyMonths > 1 ? intervalLabel(template.everyMonths) : '',
            template.endMonth ? `אחרון ב${monthLabel(template.endMonth)}` : '',
          ].filter(Boolean).join(' · ')}
        </span>
      )}

      {open && (
        <form className="row-edit" onSubmit={save}>
          <label className="field">
            סכום
            <input
              className="input num" type="number" inputMode="decimal" min="0" step="1"
              value={amount} onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          {!income && (
            <button
              type="button"
              className="recur-toggle"
              aria-pressed={offCard}
              onClick={() => setOffCard((on) => !on)}
            >
              יורד ישירות מהחשבון
              <span className="switch"><span className="knob" /></span>
            </button>
          )}

          {(income || offCard) && (
            <label className="field">
              {income ? 'נכנס ביום' : 'יורד ביום'}
              <input
                className="input num" type="number" inputMode="numeric" min="1" max="28"
                placeholder="למשל 10"
                value={dueDay} onChange={(event) => setDueDay(event.target.value)}
              />
            </label>
          )}

          <label className="field">
            קצב החיוב
            <select
              className="input rtl"
              value={everyMonths}
              onChange={(event) => setEveryMonths(event.target.value)}
            >
              {[1, 2, 3, 4, 6, 12].map((count) => (
                <option key={count} value={count}>{intervalLabel(count)}</option>
              ))}
            </select>
          </label>

          <label className="field">
            מאיזה חודש
            <MonthSelect
              value={startMonth} onChange={setStartMonth}
              from={shiftMonth(startMonth || template.startMonth, -24)} months={48}
            />
          </label>

          <label className="field">
            עד מתי
            <MonthSelect
              value={endMonth} onChange={setEndMonth}
              from={template.startMonth} allowEmpty
            />
          </label>

          {error && <p className="notice block" role="alert">{error}</p>}

          <div className="row-edit-foot">
            <button type="submit" className="mini save" disabled={busy}>
              {busy ? 'שומר...' : 'שמור'}
            </button>
            <button type="button" className="mini cancel" onClick={() => setOpen(false)}>
              ביטול
            </button>
            <button type="button" className="mini remove" onClick={() => onStop(template)}>
              הפסקה
            </button>
          </div>

          <span className="type-hint">
            השורה נוצרת בחודש שפותחים, ולכן חודש שלא נפתח מאז ההגדרה
            עדיין ריק. הזזת חודש ההתחלה אחורה מוסיפה אותו גם לחודשים
            קודמים ברגע שנכנסים אליהם.
          </span>

          <span className="type-hint">
            שינוי הסכום חל מהחודש הבא. חודשים שכבר נוצרו שומרים על מה
            ששולם בהם בפועל, ולכן חיוב שצמוד למדד ומשתנה מעט אפשר
            לעדכן בשורה של אותו חודש בלי לגעת בתבנית.
          </span>
        </form>
      )}
    </li>
  )
}

export default function Commitments({ budgetId, templates = [], month, onStop, onAdd, onClose }) {
  const live = templates.filter((template) => template.active && !isEnded(template, month))

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form">
        <h2>חיובים קבועים</h2>

        {live.length === 0 ? (
          <p className="empty">
            עדיין אין. כל הוצאה או הכנסה שתסמנו כחוזרת כל חודש תופיע כאן.
          </p>
        ) : (
          <ul className="entry-list">
            {live.map((template) => (
              <Row key={template.id} budgetId={budgetId} template={template} onStop={onStop} />
            ))}
          </ul>
        )}

        <p className="hint">
          {CATEGORIES.income.label} וחיובים שיורדים ישירות מהחשבון הם אלה
          שמקבלים תאריך, ומהם נבנה ציר החיובים הקרובים.
        </p>

        <div className="sheet-actions">
          <button type="button" className="btn-primary" onClick={onAdd}>
            + חיוב קבוע חדש
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </Sheet>
  )
}

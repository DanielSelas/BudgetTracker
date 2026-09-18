import { useState } from 'react'
import { getDocs } from 'firebase/firestore'
import { entriesRef } from '../lib/paths'
import { cleanupPlan, runCleanup } from '../lib/cleanup'
import { monthLabel, shekels } from '../lib/format'
import MonthSelect from './MonthSelect'
import { monthKey, shiftMonth } from '../lib/model'

/**
 * מחיקת היסטוריה שכבר לא נכונה.
 *
 * שני שלבים בכוונה: קודם רואים בדיוק מה יימחק, ורק אחר כך מוחקים.
 * כפתור מחיקה שפועל בלחיצה אחת על נתונים אמיתיים הוא כלי מסוכן,
 * וזה מסך תחזוקה ולא מסך יומיומי.
 */
export default function Cleanup({ budgets = [] }) {
  // הבחירה נגזרת ולא נשמרת: מסמכי התקציב מגיעים אחרי רשימת
  // החברויות, ולכן ערך התחלתי היה נתפס ריק ולא מתעדכן לעולם
  const [chosenId, setChosenId] = useState('')
  const budgetId = budgets.some((budget) => budget.id === chosenId)
    ? chosenId
    : budgets[0]?.id || ''
  const target = budgets.find((budget) => budget.id === budgetId)
  const [before, setBefore] = useState(monthKey())
  const [keepIncome, setKeepIncome] = useState(true)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')

  async function preview() {
    setBusy(true)
    setError('')
    setDone(null)
    try {
      const snapshot = await getDocs(entriesRef(budgetId))
      const entries = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setPlan({ ...cleanupPlan(entries, { before, keepIncome }), entries })
    } catch (failure) {
      setError(failure?.message || 'הקריאה נכשלה')
    }
    setBusy(false)
  }

  async function erase() {
    setBusy(true)
    setError('')
    try {
      const result = await runCleanup({
        budgetId, entries: plan.entries, before, keepIncome,
      })
      setDone(result)
      setPlan(null)
    } catch (failure) {
      setError(failure?.message || 'המחיקה נכשלה')
    }
    setBusy(false)
  }

  return (
    <section className="cat-card">
      <div className="cat-head">
        <span className="cat-title"><h2>ניקוי רשומות</h2></span>
      </div>

      <p className="hint">
        מוחק רשומות מחודשים שלפני החודש שתבחרו. החודש שנבחר עצמו נשאר,
        וכך גם כל מה שאחריו. כדאי לגבות קודם.
      </p>

      {budgets.length > 1 ? (
        <label className="field">
          תקציב
          <select
            className="input rtl" value={budgetId}
            onChange={(event) => { setChosenId(event.target.value); setPlan(null) }}
          >
            {budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>{budget.name || budget.id}</option>
            ))}
          </select>
        </label>
      ) : (
        // גם עם תקציב אחד צריך לראות על מה זה עומד לפעול
        <p className="hint">
          {target ? <>התקציב: <strong>{target.name || target.id}</strong></> : 'טוען תקציבים...'}
        </p>
      )}

      <label className="field">
        למחוק את כל מה שלפני
        <MonthSelect
          value={before} from={shiftMonth(monthKey(), -36)} months={48}
          onChange={(next) => { setBefore(next); setPlan(null) }}
        />
      </label>

      <button
        type="button" className="recur-toggle" aria-pressed={keepIncome}
        onClick={() => { setKeepIncome((on) => !on); setPlan(null) }}
      >
        להשאיר את ההכנסות
        <span className="switch"><span className="knob" /></span>
      </button>

      <div className="sheet-actions">
        <button
          type="button" className="btn-secondary"
          disabled={!budgetId || !before || busy} onClick={preview}
        >
          {busy && !plan ? 'בודק...' : 'מה יימחק'}
        </button>
      </div>

      {plan && (
        <>
          {plan.doomed.length === 0 ? (
            <p className="hint">אין מה למחוק בטווח הזה.</p>
          ) : (
            <>
              <p className="notice block">
                יימחקו <strong>{plan.doomed.length}</strong> רשומות
                מ-<strong>{plan.months.length}</strong> חודשים.
                {' '}<strong>{plan.kept}</strong> רשומות יישארו
                {plan.keptIncome > 0 && `, מהן ${plan.keptIncome} הכנסות מהחודשים שנמחקים`}.
              </p>

              <ul className="timeline">
                {plan.months.map((item) => (
                  <li className="timeline-row" key={item.month}>
                    <span className="entry-name">{monthLabel(item.month)}</span>
                    <span className="recurring-tag as-tag">{item.count}</span>
                    <span className="entry-amount num">{shekels(item.total)}</span>
                  </li>
                ))}
              </ul>

              <p className="hint">
                חודשים שנמחקו יסומנו כמדולגים בחיובים הקבועים, אחרת
                פתיחה חוזרת של אותו חודש הייתה יוצרת את השורות מחדש.
                התבניות עצמן נשארות פעילות.
              </p>

              <div className="sheet-actions">
                <button type="button" className="btn-danger" disabled={busy} onClick={erase}>
                  {busy ? 'מוחק...' : `מחיקת ${plan.doomed.length} רשומות`}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setPlan(null)}>
                  ביטול
                </button>
              </div>
            </>
          )}
        </>
      )}

      {done && (
        <p className="notice block">
          נמחקו <strong>{done.deleted}</strong> רשומות,
          ו-<strong>{done.skipped}</strong> חיובים קבועים סומנו לדילוג בחודשים שנמחקו.
        </p>
      )}

      {error && <p className="notice block" role="alert">{error}</p>}
    </section>
  )
}

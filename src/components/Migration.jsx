import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { dropLegacy, migrateBudget, snapshotForBackup, verifyBudget } from '../lib/migrate'

/**
 * מסך חד פעמי להעברת הרשומות אל תת האוסף של כל תקציב.
 * שלושה שלבים נפרדים ולא כפתור אחד: גיבוי, העתקה, ואימות. המחיקה
 * של הישן נפתחת רק אחרי שהאימות עבר, כי עד אז יש לאן לחזור.
 */
export default function Migration() {
  const { user } = useAuth()
  const { budgets, loading } = useBudget()
  const [busy, setBusy] = useState('')
  const [backedUp, setBackedUp] = useState(false)
  const [copied, setCopied] = useState(null)
  const [checks, setChecks] = useState(null)
  const [dropped, setDropped] = useState(null)
  const [error, setError] = useState('')

  const ids = (budgets || []).map((budget) => budget.id)
  const allOk = checks && checks.length > 0 && checks.every((check) => check.ok)

  async function guard(step, work) {
    setBusy(step)
    setError('')
    try {
      await work()
    } catch (failure) {
      setError(failure?.message || 'הפעולה נכשלה')
    }
    setBusy('')
  }

  const backup = () => guard('backup', async () => {
    const data = await snapshotForBackup(ids)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `budgettracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBackedUp(true)
  })

  const copy = () => guard('copy', async () => {
    const results = []
    for (const id of ids) results.push(await migrateBudget(id))
    setCopied(results)
    setChecks(null)
  })

  const verify = () => guard('verify', async () => {
    const results = []
    for (const id of ids) results.push(await verifyBudget(id))
    setChecks(results)
  })

  const drop = () => guard('drop', async () => {
    const results = []
    for (const id of ids) results.push(await dropLegacy(id))
    setDropped(results)
  })

  const nameOf = (id) => budgets.find((budget) => budget.id === id)?.name || id

  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <h1>העברת מבנה הנתונים</h1>
            <p className="muted">
              רשומות עוברות מאוסף אחד משותף אל תת אוסף של כל תקציב.
            </p>
          </div>
        </header>

        {!user && <p className="notice block">צריך להתחבר קודם.</p>}
        {loading && <p className="hint">טוען את התקציבים...</p>}

        {user && !loading && (
          <>
            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>התקציבים שיעברו</h2></span>
                <span className="cat-total num">{ids.length}</span>
              </div>
              <ul className="entry-list">
                {budgets.map((budget) => (
                  <li className="entry-row" key={budget.id}>
                    <span className="entry-name">{budget.name}</span>
                    <span className="recurring-tag as-tag">{budget.type || 'household'}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>1. גיבוי</h2></span>
              </div>
              <p className="hint">
                מוריד קובץ JSON עם כל הרשומות כפי שהן עכשיו. זה מה שיציל
                אתכם אם משהו ישתבש, אז אל תדלגו.
              </p>
              <button type="button" className="btn-primary" disabled={busy === 'backup'} onClick={backup}>
                {busy === 'backup' ? 'מגבה...' : backedUp ? 'הורד שוב' : 'הורדת גיבוי'}
              </button>
              {backedUp && <p className="hint">הגיבוי ירד ✓</p>}
            </section>

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>2. העתקה</h2></span>
              </div>
              <p className="hint">
                מעתיק, לא מעביר. הרשומות הישנות נשארות במקומן עד שתמחקו אותן
                בשלב 4. הרצה חוזרת בטוחה, היא כותבת מעל אותם מסמכים.
              </p>
              <button type="button" className="btn-primary" disabled={!backedUp || busy === 'copy'} onClick={copy}>
                {busy === 'copy' ? 'מעתיק...' : 'העתקה'}
              </button>
              {!backedUp && <p className="hint">זמין אחרי הגיבוי.</p>}
              {copied && (
                <ul className="entry-list">
                  {copied.map((result) => (
                    <li className="entry-row" key={result.budgetId}>
                      <span className="entry-name">{nameOf(result.budgetId)}</span>
                      <span className="entry-amount num">{result.written} שורות</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>3. אימות</h2></span>
              </div>
              <p className="hint">
                סופר את הרשומות ומסכם את הסכומים בשני המקומות. שניהם חייבים
                להיות זהים.
              </p>
              <button type="button" className="btn-primary" disabled={!copied || busy === 'verify'} onClick={verify}>
                {busy === 'verify' ? 'בודק...' : 'אימות'}
              </button>
              {checks && (
                <ul className="entry-list">
                  {checks.map((check) => (
                    <li className="entry-row" key={check.budgetId}>
                      <span className="entry-name">{nameOf(check.budgetId)}</span>
                      <span className="recurring-tag as-tag">
                        {check.legacyCount} → {check.movedCount}
                      </span>
                      <span className="entry-amount num">{check.ok ? '✓' : '✗'}</span>
                    </li>
                  ))}
                </ul>
              )}
              {checks && !allOk && (
                <p className="notice block" role="alert">
                  יש פער בין הישן לחדש. אל תמחקו כלום, תגידו לי מה מופיע כאן.
                </p>
              )}
            </section>

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>4. מחיקת הישן</h2></span>
              </div>
              <p className="hint">
                רק אחרי שהאפליקציה עברה למבנה החדש ועבדה כמה ימים.
                אין למהר לכאן.
              </p>
              <button
                type="button"
                className="btn-text danger-text"
                disabled={!allOk || busy === 'drop'}
                onClick={drop}
              >
                {busy === 'drop' ? 'מוחק...' : 'מחיקת האוסף הישן'}
              </button>
              {!allOk && <p className="hint">זמין רק אחרי אימות תקין.</p>}
              {dropped && (
                <p className="hint">
                  נמחקו {dropped.reduce((total, item) => total + item.deleted, 0)} שורות.
                </p>
              )}
            </section>

            {error && <p className="notice block" role="alert">{error}</p>}
          </>
        )}
      </div>
    </main>
  )
}

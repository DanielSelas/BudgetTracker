import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Rekey from './Rekey'
import { useBudget } from '../context/BudgetContext'
import {
  diagnose, dropLegacy, migrateBudget, resetTarget, snapshotForBackup, verifyBudget,
} from '../lib/migrate'

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
  const [dump, setDump] = useState('')
  const [copiedDump, setCopiedDump] = useState(false)
  const [copied, setCopied] = useState(null)
  const [checks, setChecks] = useState(null)
  const [dropped, setDropped] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const ids = (budgets || []).map((budget) => budget.id)
  const allOk = checks && checks.length > 0 && checks.every((check) => check.ok)

  async function guard(step, work) {
    setBusy(step)
    setError('')
    try {
      await work()
    } catch (failure) {
      // הקוד של Firestore הוא מה שבאמת מסביר מה קרה, ולכן הוא מוצג
      const code = failure?.code ? ` (${failure.code})` : ''
      setError(`${failure?.message || 'הפעולה נכשלה'}${code}`)
    }
    setBusy('')
  }

  /**
   * שלוש דרכים להוציא את הגיבוי, לפי מה שהמכשיר תומך בו.
   * הורדת קובץ שבירה באייפון ובאפליקציה מותקנת היא לא עובדת בכלל,
   * ולכן שיתוף קודם, ואם הכל נכשל הטקסט מוצג להעתקה ידנית.
   */
  const backup = () => guard('backup', async () => {
    const data = await snapshotForBackup(ids)
    const text = JSON.stringify(data, null, 2)
    const name = `budgettracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    setDump(text)

    const file = new File([text], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'גיבוי BudgetTracker' })
        setBackedUp(true)
        return
      } catch {
        // ביטול של המשתמש או חוסר תמיכה. ממשיכים לדרך הבאה
      }
    }

    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      // נשארת ההעתקה הידנית, שמוצגת ממילא
    }
    setBackedUp(true)
  })

  const copyDump = async () => {
    try {
      await navigator.clipboard.writeText(dump)
      setCopiedDump(true)
    } catch {
      setCopiedDump(false)
    }
  }

  // ניקוי ואז העתקה. הצד החדש הוא עותק בלבד כל עוד האפליקציה קוראת
  // מהישן, ולכן מחיקתו בטוחה והיא מה שמנקה הרצות קודמות שהשתבשו.
  const copy = () => guard('copy', async () => {
    const results = []
    for (const id of ids) {
      await resetTarget(id)
      results.push(await migrateBudget(id))
    }
    setCopied(results)
    setChecks(null)
    setReport(null)
  })

  const verify = () => guard('verify', async () => {
    const results = []
    for (const id of ids) results.push(await verifyBudget(id))
    setChecks(results)
  })

  const explain = () => guard('explain', async () => {
    const results = []
    for (const id of ids) results.push({ id, ...(await diagnose(id)) })
    setReport(results)
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
          <button
            type="button"
            className="btn-text"
            onClick={() => { window.location.hash = ''; window.location.reload() }}
          >
            חזרה
          </button>
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

            <Rekey />

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>1. גיבוי</h2></span>
              </div>
              <p className="hint">
                כל הרשומות כפי שהן עכשיו. בטלפון זה ייפתח בחלון שיתוף,
                ובמחשב ירד כקובץ. זה מה שיציל אתכם אם משהו ישתבש, אל תדלגו.
              </p>
              <button type="button" className="btn-primary" disabled={busy === 'backup'} onClick={backup}>
                {busy === 'backup' ? 'מגבה...' : backedUp ? 'גיבוי נוסף' : 'גיבוי'}
              </button>
              {backedUp && <p className="hint">הגיבוי הופק ✓</p>}

              {dump && (
                <div className="backup-copy">
                  <p className="hint">
                    אם השיתוף או ההורדה לא עבדו, אפשר להעתיק את הגיבוי מכאן
                    ולשלוח לעצמכם. {Math.round(dump.length / 1024)} ק״ב.
                  </p>
                  <textarea className="input" readOnly rows={4} value={dump} />
                  <button type="button" className="btn-text" onClick={copyDump}>
                    {copiedDump ? 'הועתק ✓' : 'העתקת הגיבוי'}
                  </button>
                </div>
              )}
            </section>

            <section className="cat-card">
              <div className="cat-head">
                <span className="cat-title"><h2>2. העתקה</h2></span>
              </div>
              <p className="hint">
                מעתיק, לא מעביר. הרשומות הישנות נשארות במקומן עד שתמחקו אותן
                בשלב 4. כל הרצה מנקה קודם את מה שהועתק ומעתיקה מחדש, ולכן
                אפשר להריץ שוב בלי לשכפל.
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
                        ישן {check.legacyCount}
                      </span>
                      <span className="recurring-tag as-tag">
                        חדש {check.movedCount}
                      </span>
                      <span className="entry-amount num">{check.ok ? '✓' : '✗'}</span>
                    </li>
                  ))}
                </ul>
              )}
              {checks && !allOk && (
                <>
                  <p className="notice block" role="alert">
                    יש פער בין הישן לחדש. אל תמחקו כלום.
                  </p>
                  <button type="button" className="btn-primary" disabled={busy === 'explain'} onClick={explain}>
                    {busy === 'explain' ? 'בודק...' : 'מה חסר?'}
                  </button>
                </>
              )}

              {report && (
                <div className="backup-copy">
                  <p className="hint">העתיקו את זה ושלחו לי.</p>
                  <textarea
                    className="input"
                    readOnly
                    rows={10}
                    value={JSON.stringify(report, null, 2)}
                  />
                </div>
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

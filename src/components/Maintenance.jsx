import { useState } from 'react'
import Rekey from './Rekey'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { backupAll } from '../lib/rekey'

/**
 * מסך תחזוקה, מאחורי כתובת ולא מאחורי כפתור: אין סיבה שהוא יופיע
 * במסלול של מי שרק רוצה להזין הוצאה.
 */
export default function Maintenance() {
  const { user } = useAuth()
  const { budgets, loading } = useBudget()
  const [busy, setBusy] = useState(false)
  const [dump, setDump] = useState('')
  const [error, setError] = useState('')

  async function backup() {
    setBusy(true)
    setError('')
    try {
      const data = await backupAll(budgets.map((budget) => budget.id))
      const text = JSON.stringify(data, null, 2)
      const name = `budgettracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      setDump(text)

      // שיתוף קודם, כי הורדת קובץ שבירה באייפון ובאפליקציה מותקנת
      // היא לא עובדת בכלל. ואם שניהם נכשלו, הטקסט מוצג להעתקה.
      const file = new File([text], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'גיבוי BudgetTracker' })
          setBusy(false)
          return
        } catch {
          // ביטול או חוסר תמיכה. ממשיכים לדרך הבאה
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
    } catch (failure) {
      setError(failure?.message || 'הגיבוי נכשל')
    }
    setBusy(false)
  }

  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <h1>תחזוקה</h1>
            <p className="muted">כלים חד פעמיים. לא נדרשים לשימוש רגיל.</p>
          </div>
          <button
            type="button"
            className="btn-text quiet"
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
                <span className="cat-title"><h2>גיבוי</h2></span>
              </div>
              <p className="hint">
                כל הרשומות כפי שהן עכשיו. בטלפון זה ייפתח בחלון שיתוף,
                ובמחשב ירד כקובץ.
              </p>
              <button type="button" className="btn-primary" disabled={busy} onClick={backup}>
                {busy ? 'מגבה...' : 'גיבוי'}
              </button>

              {dump && (
                <div className="backup-copy">
                  <p className="hint">
                    אם השיתוף וההורדה לא עבדו, אפשר להעתיק מכאן.
                    {' '}{Math.round(dump.length / 1024)} ק״ב.
                  </p>
                  <textarea className="input" readOnly rows={4} value={dump} />
                </div>
              )}

              {error && <p className="notice block" role="alert">{error}</p>}
            </section>

            <Rekey />
          </>
        )}
      </div>
    </main>
  )
}

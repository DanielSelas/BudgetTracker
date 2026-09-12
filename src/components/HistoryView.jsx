import { lazy, Suspense, useState } from 'react'
import HistoryTable from './HistoryTable'
import { useHistory } from '../hooks/useHistory'

// Recharts גדול משמעותית משאר האפליקציה, ומסך החודש לא זקוק לו.
// טעינה עצלה שומרת על זמן העלייה הראשוני של המסך הראשי.
const Charts = lazy(() => import('./HistoryCharts'))

const RANGES = [
  { months: 6, label: '6 חודשים' },
  { months: 12, label: 'שנה' },
]

export default function HistoryView({ budgetId }) {
  const [monthCount, setMonthCount] = useState(6)
  const [view, setView] = useState('chart')
  const { series, loading, error, hasData } = useHistory(budgetId, monthCount)

  if (error) {
    const needsIndex = error.code === 'failed-precondition'
    return (
      <section className="card">
        <h2>היסטוריה</h2>
        <p className="error" role="alert">
          {needsIndex
            ? 'חסר אינדקס ב-Firestore לשאילתה הזו. פתח את הקונסול של הדפדפן. Firestore מדפיס שם קישור שיוצר אותו בלחיצה אחת.'
            : `שגיאה בטעינת ההיסטוריה: ${error.code || 'unknown'}`}
        </p>
      </section>
    )
  }

  return (
    <section className="card history">
      <header className="category-head">
        <h2>היסטוריה</h2>
        <div className="toggle-group">
          {RANGES.map((range) => (
            <button
              key={range.months}
              type="button"
              className={monthCount === range.months ? '' : 'secondary'}
              onClick={() => setMonthCount(range.months)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p>טוען...</p>
      ) : !hasData ? (
        <p className="empty">אין עדיין נתונים להצגה. הזן הכנסות והוצאות וחזור לכאן.</p>
      ) : (
        <>
          <div className="toggle-group">
            <button
              type="button"
              className={view === 'chart' ? '' : 'secondary'}
              onClick={() => setView('chart')}
            >
              גרף
            </button>
            <button
              type="button"
              className={view === 'table' ? '' : 'secondary'}
              onClick={() => setView('table')}
            >
              טבלה
            </button>
          </div>

          {view === 'chart' ? (
            <Suspense fallback={<p>טוען גרפים...</p>}>
              <Charts series={series} />
            </Suspense>
          ) : (
            <HistoryTable series={series} />
          )}
        </>
      )}
    </section>
  )
}

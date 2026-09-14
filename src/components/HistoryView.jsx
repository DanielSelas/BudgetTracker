import { useMemo } from 'react'
import { useHistory } from '../hooks/useHistory'
import { CATEGORIES, monthKey } from '../lib/model'

const GROUPS = [
  { group: 'fixed', label: CATEGORIES.fixed.label, category: 'fixed', target: 50 },
  { group: 'leisure', label: CATEGORIES.leisure.label, category: 'leisure', target: 30 },
  { group: 'savings', label: CATEGORIES.fund.label, category: 'fund', target: 20 },
]

const SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const shortMonth = (key) => SHORT[Number(key.split('-')[1]) - 1]

const BAR_HEIGHT = 160

export default function HistoryView({ budgetId, fixedBase = 0 }) {
  const { series, loading, error, hasData } = useHistory(budgetId, 6, fixedBase)
  const current = monthKey()

  // הגבהים יחסיים לסכום הגדול ביותר שהופיע בטווח, כך שההשוואה בין חודשים נכונה
  const peak = useMemo(
    () => Math.max(1, ...series.flatMap((point) => GROUPS.map((g) => point.groups[g.group].actual))),
    [series],
  )

  // ממוצע הנתח בפועל מתוך סכום הבסיס, רק בחודשים שבהם היה בסיס
  const averages = useMemo(() => {
    const withBase = series.filter((point) => point.baseAmount > 0)
    return GROUPS.map((g) => {
      if (withBase.length === 0) return { ...g, percent: 0 }
      const sum = withBase.reduce(
        (total, point) => total + point.groups[g.group].actual / point.baseAmount,
        0,
      )
      return { ...g, percent: Math.round((sum / withBase.length) * 100) }
    })
  }, [series])

  if (error) {
    const needsIndex = error.code === 'failed-precondition'
    return (
      <div className="app-scroll">
        <p className="notice block" role="alert">
          {needsIndex
            ? 'חסר אינדקס ב-Firestore לשאילתה הזו. הרצת npm run deploy יוצרת אותו.'
            : `שגיאה בטעינת ההיסטוריה: ${error.code || 'unknown'}`}
        </p>
      </div>
    )
  }

  return (
    <div className="app-scroll">
      <header className="screen-head">
        <div>
          <h2>שישה חודשים אחורה</h2>
          <p className="muted">איך עמדתם ביחס 50/30/20 בפועל.</p>
        </div>
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: 280 }} />
      ) : !hasData ? (
        <p className="empty">אין עדיין נתונים להצגה. הזינו הכנסות והוצאות וחזרו לכאן.</p>
      ) : (
        <>
          <section className="chart-card">
            <div className="legend">
              {GROUPS.map((g) => (
                <span key={g.group}>
                  <span className="swatch" style={{ background: `var(--cat-${g.category}-base)` }} />
                  {g.label}
                </span>
              ))}
            </div>

            <div className="bars">
              {series.map((point) => (
                <div
                  key={point.month}
                  className={`bars-col ${point.month === current ? 'current' : ''}`}
                >
                  <div className="bars-group">
                    {GROUPS.map((g) => {
                      const actual = point.groups[g.group].actual
                      return (
                        <i
                          key={g.group}
                          style={{
                            height: `${(actual / peak) * BAR_HEIGHT}px`,
                            background: `var(--cat-${g.category}-base)`,
                          }}
                          title={`${g.label} ${shortMonth(point.month)}`}
                        />
                      )
                    })}
                  </div>
                  <span className="m">{shortMonth(point.month)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="avg-list">
            {averages.map((g) => (
              <div key={g.group} className="avg-card" data-category={g.category}>
                <span className="name">{g.label} בממוצע</span>
                <span className="val">
                  <strong className="num">{g.percent}%</strong>
                  <span className="num">יעד {g.target}%</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

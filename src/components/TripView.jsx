import { useMemo, useState } from 'react'
import EntryRow from './EntryRow'
import EntrySheet from './EntrySheet'
import { shekels } from '../lib/format'
import { TRIP_CATEGORIES, TRIP_ORDER, summarizeTrip } from '../lib/model'
import { memberIndex } from '../lib/members'
import { useTripEntries, tripActions } from '../hooks/useTripEntries'

function Skeleton() {
  return (
    <>
      <div className="skeleton" style={{ height: 180 }} />
      <div className="skeleton" style={{ height: 140 }} />
    </>
  )
}

function TripCategory({ category, entries, total, authorOf, actions, onAdd }) {
  return (
    <section className="cat-card" data-category={category}>
      <div className="cat-head">
        <span className="cat-title">
          <span className="dot" />
          <h2>{TRIP_CATEGORIES[category].label}</h2>
        </span>
        <span className="cat-total num">{shekels(total)}</span>
      </div>

      {entries.length > 0 ? (
        <ul className="entry-list">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              author={authorOf?.(entry.addedBy)}
              onUpdate={actions.update}
              onRemove={actions.remove}
            />
          ))}
        </ul>
      ) : (
        <p className="empty">אין עדיין שורות</p>
      )}

      <button type="button" className="btn-text" onClick={() => onAdd(category)}>
        + הוספה
      </button>
    </section>
  )
}

export default function TripView({ budgetId, budget, uid }) {
  const [sheet, setSheet] = useState(null)
  const { entries, loading, error } = useTripEntries(budgetId)

  const actions = useMemo(() => tripActions({ budgetId, uid }), [budgetId, uid])
  const summary = useMemo(() => summarizeTrip(entries, budget?.frame || 0), [entries, budget?.frame])
  const members = useMemo(() => memberIndex(budget?.members), [budget?.members])
  const shared = members.sorted.length > 1
  const over = summary.remaining < 0

  return (
    <>
      <div className="sticky-head">
        <header className="trip-head">
          <h1>{budget?.name || 'טיול'}</h1>
          <p className="muted">{shared ? `משותף · ${members.sorted.length}` : 'אישי'}</p>
        </header>
      </div>

      <div className="app-scroll">
        {error && (
          <p className="notice block" role="alert">
            שגיאה בטעינת הנתונים: <code>{error.code || 'unknown'}</code>
          </p>
        )}

        {loading ? <Skeleton /> : (
          <>
            <section className="summary">
              <div className="summary-hero">
                <span className="cap">{over ? 'חריגה מהמסגרת' : 'נשאר מהמסגרת'}</span>
                <span className={`amount num ${over ? 'negative' : ''}`}>
                  {shekels(Math.abs(summary.remaining))}
                </span>
              </div>

              <div className="summary-tiles">
                <div>
                  <span className="cap">מסגרת</span>
                  <span className="val num">{shekels(summary.frame)}</span>
                </div>
                <div>
                  <span className="cap">הוצא</span>
                  <span className="val num">{shekels(summary.spent)}</span>
                </div>
              </div>

              <div className="bar">
                <div
                  className={`bar-fill ${over ? 'danger' : ''}`}
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
            </section>

            {TRIP_ORDER.map((category) => (
              <TripCategory
                key={category}
                category={category}
                entries={summary.byCategory[category]}
                total={summary.totals[category]}
                authorOf={shared ? members.get : null}
                actions={actions}
                onAdd={setSheet}
              />
            ))}
          </>
        )}
      </div>

      <button type="button" className="fab" onClick={() => setSheet('lodging')}>
        <span className="plus">+</span> הוצאה
      </button>

      {sheet && (
        <EntrySheet
          mode="trip"
          initialCategory={sheet}
          summary={summary}
          me={members.get(uid)}
          onSubmit={actions.add}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

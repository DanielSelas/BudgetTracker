import { useMemo, useState } from 'react'
import EntryRow from './EntryRow'
import EntrySheet from './EntrySheet'
import ConfirmDialog from './ConfirmDialog'
import BackToBudgets from './BackToBudgets'
import RenameDialog from './RenameDialog'
import Sheet from './Sheet'
import InvitePanel from './InvitePanel'
import { renameBudget } from '../lib/budgets'
import FrameLink from './FrameLink'
import { shekels } from '../lib/format'
import { TRIP_CATEGORIES, TRIP_ORDER, summarizeTrip } from '../lib/model'
import { TRIP_PILLS } from '../lib/pills'
import { memberIndex } from '../lib/members'
import { useProfiles } from '../hooks/useProfiles'
import { useFrameEntries, frameActions } from '../hooks/useFrameEntries'
import { useTripRollup } from '../hooks/useTripRollup'
import { deleteTrip } from '../lib/trips'

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
              categories={TRIP_PILLS}
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

export default function TripView({ budgetId, budget, uid, onDeleted }) {
  const [sheet, setSheet] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const { entries, loading, error } = useFrameEntries(budgetId)

  const actions = useMemo(() => frameActions({ budgetId, uid }), [budgetId, uid])
  const summary = useMemo(() => summarizeTrip(entries, budget?.frame || 0), [entries, budget?.frame])
  const memberList = budget?.members
  const memberUids = useMemo(
    () => (memberList || []).map((member) => member.uid),
    [memberList],
  )
  const profiles = useProfiles(memberUids)
  const members = useMemo(() => memberIndex(memberList, profiles), [memberList, profiles])
  const shared = members.sorted.length > 1
  const over = summary.remaining < 0
  const isOwner = budget?.ownerUid === uid
  const months = useMemo(
    () => [...new Set(entries.map((entry) => entry.month).filter(Boolean))],
    [entries],
  )

  const { error: rollupError, syncedAt } = useTripRollup({
    trip: budget ? { ...budget, id: budgetId } : null,
    entries,
    uid,
    ready: !loading,
  })

  async function handleDelete() {
    setConfirmDelete(false)
    await deleteTrip({
      trip: { ...budget, id: budgetId },
      memberUids: members.sorted.map((member) => member.uid),
    })
    onDeleted?.()
  }

  return (
    <>
      <div className="sticky-head">
        <BackToBudgets onClick={onDeleted} />
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

        {rollupError && (
          <p className="notice block" role="alert">
            לא הצלחנו לעדכן את התקציב המקושר. ודאו שאתם חברים גם בו.
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

            <FrameLink
              kind="trip"
              budgetId={budgetId}
              budget={budget}
              months={months}
              synced={Boolean(syncedAt)}
            />

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
            <div className="budget-actions">
              <button type="button" className="btn-text" onClick={() => setSharing(true)}>
                הזמנת שותף
              </button>
              {isOwner && (
                <>
                  <button type="button" className="btn-text" onClick={() => setRenaming(true)}>
                    שינוי שם
                  </button>
                  <button type="button" className="btn-text danger-text" onClick={() => setConfirmDelete(true)}>
                    מחיקה
                  </button>
                </>
              )}
            </div>
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

      {sharing && (
        <Sheet onClose={() => setSharing(false)}>
          <InvitePanel budgetId={budgetId} budgetName={budget?.name} heading="הזמנה לטיול" />
        </Sheet>
      )}

      {renaming && (
        <RenameDialog
          title="שינוי שם הטיול"
          label="שם הטיול"
          value={budget?.name}
          onSave={async (name) => {
            await renameBudget({ budgetId, name })
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="למחוק את הטיול?"
          body={`כל ההוצאות של "${budget?.name}" יימחקו, וגם השורות המסכמות שלו בתקציב הבית. אי אפשר לבטל.`}
          confirmLabel="מחיקה"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

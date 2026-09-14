import { useMemo, useState } from 'react'
import CategoryCard from './CategoryCard'
import SummaryCard from './SummaryCard'
import UnplannedCard from './UnplannedCard'
import MonthPicker from './MonthPicker'
import EntrySheet from './EntrySheet'
import ConfirmDialog from './ConfirmDialog'
import RenameDialog from './RenameDialog'
import BillingDayDialog from './BillingDayDialog'
import BaseAmountDialog from './BaseAmountDialog'
import Sheet from './Sheet'
import InvitePanel from './InvitePanel'
import { useEntries, entryActions } from '../hooks/useEntries'
import { useRecurring } from '../hooks/useRecurring'
import { createTemplate, skipMonth, stopTemplate } from '../lib/recurring'
import { CATEGORIES, monthKey, summarizeMonth } from '../lib/model'
import { usedGroups } from '../lib/groups'
import { displayName, memberIndex } from '../lib/members'
import { deleteBudget, renameBudget, setBaseAmount, setBillingDay } from '../lib/budgets'

const ORDER = ['income', 'fixed', 'leisure', 'fund']

function Skeleton() {
  return (
    <>
      <div className="skeleton" style={{ height: 210 }} />
      <div className="skeleton" style={{ height: 108 }} />
      <div className="skeleton" style={{ height: 180 }} />
    </>
  )
}

export default function MonthView({ budgetId, budget, uid, nudge, onDeleted }) {
  const [month, setMonth] = useState(monthKey)
  const [sheet, setSheet] = useState(nudge ? { category: nudge.category, group: '' } : null)
  const [prefill, setPrefill] = useState(nudge?.amount ?? 0)
  const [pendingStop, setPendingStop] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [editingBilling, setEditingBilling] = useState(false)
  const [editingBase, setEditingBase] = useState(false)
  const { byCategory, entries, loading, error } = useEntries(budgetId, month)

  const base = useMemo(() => entryActions({ budgetId, month, uid }), [budgetId, month, uid])
  const { error: recurringError } = useRecurring({
    budgetId, month, uid, entries, entriesLoaded: !loading,
  })

  const actions = useMemo(() => ({
    ...base,
    add: async ({ recurring, ...values }) => {
      if (!recurring) return base.add(values)
      // התבנית היא המקור; השורה של החודש הזה נגזרת ממנה אוטומטית
      return createTemplate({ budgetId, uid, month, ...values })
    },
    // מחיקת שורה שנוצרה מתבנית מדלגת על החודש הזה בלבד,
    // אחרת היא הייתה נוצרת מחדש מיד בכניסה הבאה לחודש.
    remove: async (entryId, entry) => {
      if (entry?.recurringId) await skipMonth(budgetId, entry.recurringId, month)
      return base.remove(entryId)
    },
  }), [base, budgetId, month, uid])

  const fixedBase = budget?.baseAmount
  const summary = useMemo(
    () => summarizeMonth(entries, { fixedBase }),
    [entries, fixedBase],
  )
  // הקבוצות שכבר בשימוש החודש, כדי שהוספה חוזרת תהיה בחירה ולא הקלדה
  const groups = useMemo(() => usedGroups(entries), [entries])
  const openSheet = (category, group = '', amount = 0) => {
    setPrefill(amount)
    setSheet({ category, group })
  }
  // בלי הכנסה אין סכום בסיס, ולכן כל היעדים אפס וכל המסך חסר משמעות.
  // זו הפעולה הראשונה שצריך לעשות בחודש חדש, ולכן היא מקבלת הבלטה.
  const needsIncome = !loading && summary.totalIncome === 0
  const members = useMemo(() => memberIndex(budget?.members), [budget?.members])
  const me = members.get(uid)
  const partner = members.sorted.find((member) => member.uid !== uid)
  const shared = members.sorted.length > 1
  const isOwner = budget?.ownerUid === uid

  async function handleDelete() {
    setConfirmDelete(false)
    await deleteBudget({
      budgetId,
      ownerUid: budget.ownerUid,
      memberUids: members.sorted.map((member) => member.uid),
    })
    onDeleted?.()
  }

  // שתי תקלות שונות לגמרי, ולכן שתי הודעות שונות. איחוד שלהן לטקסט
  // אחד הפך אבחון של permission-denied לניחוש.
  const failure = error
    ? { what: 'קריאת הרשומות של החודש', error }
    : recurringError
      ? { what: 'סנכרון החיובים הקבועים', error: recurringError }
      : null

  return (
    <>
      <div className="sticky-head">
        <MonthPicker
          month={month}
          onChange={setMonth}
          subtitle={budget ? `${budget.name} · ${shared ? 'משותף' : 'אישי'}` : ''}
          billingDay={budget?.billingDay}
        />
      </div>

      <div className="app-scroll">
        {failure && (
          <p className="notice block" role="alert">
            {failure.what} נכשל: <code>{failure.error.code || 'unknown'}</code>
          </p>
        )}

        {loading ? <Skeleton /> : (
          <>
            <SummaryCard summary={summary} />

            {needsIncome && (
              <button
                type="button"
                className="prompt-card"
                data-category="income"
                onClick={() => openSheet('income')}
              >
                <span className="prompt-title">מתחילים מהכנסה</span>
                <span className="prompt-body">
                  סכום הבסיס והיעדים של 50/30/20 מחושבים מההכנסה של החודש.
                  עד שתזינו אותה, כל היעדים יישארו אפס.
                </span>
                <span className="prompt-cta">+ הוספת הכנסה</span>
              </button>
            )}

            {ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                entries={byCategory[category]}
                group={summary.groups[CATEGORIES[category].budgetGroup]}
                authorOf={shared ? members.get : null}
                actions={actions}
                onAdd={openSheet}
                onStopRecurring={setPendingStop}
              />
            ))}

            {/* השארית אחרונה: היא מה שנותר מעבר לתוכנית, ולא חלק ממנה */}
            <UnplannedCard
              summary={summary}
              onDeposit={(amount) => openSheet('fund', '', amount)}
              entries={byCategory.unplanned}
              authorOf={shared ? members.get : null}
              actions={actions}
              onAdd={openSheet}
              onStopRecurring={setPendingStop}
            />

            <div className="owner-actions">
              <button type="button" className="btn-text" onClick={() => setSharing(true)}>
                הזמנת שותף
              </button>
              {isOwner && (
                <>
                  <button type="button" className="btn-text" onClick={() => setEditingBase(true)}>
                    סכום הבסיס
                  </button>
                  <button type="button" className="btn-text" onClick={() => setEditingBilling(true)}>
                    מועד חיוב
                  </button>
                  <button type="button" className="btn-text" onClick={() => setRenaming(true)}>
                    שינוי שם התקציב
                  </button>
                  <button type="button" className="btn-text danger-text" onClick={() => setConfirmDelete(true)}>
                    מחיקת התקציב
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => openSheet(needsIncome ? 'income' : 'fixed')}
      >
        <span className="plus">+</span> {needsIncome ? 'הכנסה' : 'הוצאה'}
      </button>

      {sheet && (
        <EntrySheet
          initialCategory={sheet.category}
          initialGroup={sheet.group}
          groups={groups}
          initialAmount={prefill}
          summary={summary}
          me={me}
          partner={partner ? displayName(partner) : ''}
          onSubmit={actions.add}
          onClose={() => { setSheet(null); setPrefill(0) }}
        />
      )}

      {sharing && (
        <Sheet onClose={() => setSharing(false)}>
          <InvitePanel budgetId={budgetId} budgetName={budget?.name} heading="הזמנה לתקציב" />
        </Sheet>
      )}

      {editingBase && (
        <BaseAmountDialog
          value={budget?.baseAmount}
          onSave={async (next) => {
            await setBaseAmount({ budgetId, baseAmount: next })
            setEditingBase(false)
          }}
          onCancel={() => setEditingBase(false)}
        />
      )}

      {editingBilling && (
        <BillingDayDialog
          value={budget?.billingDay}
          onSave={async (day) => {
            await setBillingDay({ budgetId, billingDay: day })
            setEditingBilling(false)
          }}
          onCancel={() => setEditingBilling(false)}
        />
      )}

      {renaming && (
        <RenameDialog
          title="שינוי שם התקציב"
          label="שם התקציב"
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
          title="למחוק את התקציב?"
          body={`כל הרשומות והחיובים הקבועים של "${budget?.name}" יימחקו, וגם החברים שבו. אי אפשר לבטל.`}
          confirmLabel="מחיקה"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {pendingStop && (
        <ConfirmDialog
          title="להפסיק את החיוב הקבוע?"
          body={`"${pendingStop.name}" לא יתווסף יותר בחודשים הבאים. השורה של החודש הזה ושל החודשים הקודמים תישאר.`}
          confirmLabel="הפסק"
          onConfirm={() => {
            stopTemplate(budgetId, pendingStop.recurringId)
            setPendingStop(null)
          }}
          onCancel={() => setPendingStop(null)}
        />
      )}
    </>
  )
}

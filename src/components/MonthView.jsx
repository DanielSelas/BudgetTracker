import { useMemo, useState } from 'react'
import CategoryCard from './CategoryCard'
import SummaryCard from './SummaryCard'
import MonthVerdict from './MonthVerdict'
import EndingSoon from './EndingSoon'
import UpcomingCharges from './UpcomingCharges'
import Commitments from './Commitments'
import UnplannedCard from './UnplannedCard'
import MonthPicker from './MonthPicker'
import BackToBudgets from './BackToBudgets'
import EntrySheet from './EntrySheet'
import ConfirmDialog from './ConfirmDialog'
import RenameDialog from './RenameDialog'
import BillingDayDialog from './BillingDayDialog'
import BaseAmountDialog from './BaseAmountDialog'
import Sheet from './Sheet'
import InvitePanel from './InvitePanel'
import { useEntries, entryActions } from '../hooks/useEntries'
import { useRecurring } from '../hooks/useRecurring'
import { createTemplate, endingSoon, skipMonth, stopTemplate, upcomingCharge } from '../lib/recurring'
import { CATEGORIES, activeMonth, isMonthClosed, summarizeMonth } from '../lib/model'
import { usedGroups } from '../lib/groups'
import { displayName, memberIndex } from '../lib/members'
import { useProfiles } from '../hooks/useProfiles'
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

export default function MonthView({ budgetId, budget, uid, nudge, onBack, onDeleted }) {
  const billingDay = budget?.billingDay
  // נפתח על המחזור שרץ עכשיו, שאינו בהכרח החודש שבלוח
  const [month, setMonth] = useState(() => activeMonth(billingDay))
  // רק מחזור שנסגר אפשר לסכם, ולכן הוא נסגר במועד החיוב ולא ב-30 בחודש
  const isPast = isMonthClosed(month, billingDay)
  const [sheet, setSheet] = useState(nudge ? { category: nudge.category, group: '' } : null)
  const [prefill, setPrefill] = useState(nudge?.amount ?? 0)
  const [pendingStop, setPendingStop] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [editingBilling, setEditingBilling] = useState(false)
  const [editingBase, setEditingBase] = useState(false)
  const [showCommitments, setShowCommitments] = useState(false)
  const { byCategory, entries, loading, error } = useEntries(budgetId, month)

  const base = useMemo(() => entryActions({ budgetId, month, uid }), [budgetId, month, uid])
  const { templates, error: recurringError } = useRecurring({
    budgetId, month, uid, entries, entriesLoaded: !loading,
  })
  const ending = useMemo(() => endingSoon(templates, month), [templates, month])

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
  const summary = useMemo(() => {
    const base = summarizeMonth(entries, { fixedBase })
    return { ...base, upcoming: upcomingCharge(entries, templates) }
  }, [entries, fixedBase, templates])
  // הקבוצות שכבר בשימוש החודש, כדי שהוספה חוזרת תהיה בחירה ולא הקלדה
  const groups = useMemo(() => usedGroups(entries), [entries])
  const openSheet = (category, group = '', amount = 0, fromRemainder = false, recurring = false) => {
    setPrefill(amount)
    setSheet({ category, group, fromRemainder, recurring })
  }
  // בלי הכנסה אין סכום בסיס, ולכן כל היעדים אפס וכל המסך חסר משמעות.
  // זו הפעולה הראשונה שצריך לעשות בחודש חדש, ולכן היא מקבלת הבלטה.
  const needsIncome = !loading && summary.totalIncome === 0
  const memberList = budget?.members
  const memberUids = useMemo(
    () => (memberList || []).map((member) => member.uid),
    [memberList],
  )
  const profiles = useProfiles(memberUids)
  const members = useMemo(() => memberIndex(memberList, profiles), [memberList, profiles])
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
        <BackToBudgets onClick={onBack} />
        <MonthPicker
          month={month}
          onChange={setMonth}
          current={activeMonth(billingDay)}
          subtitle={budget ? `${budget.name} · ${shared ? 'משותף' : 'אישי'}` : ''}
          billingDay={billingDay}
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

            {isPast && <MonthVerdict summary={summary} />}

            {!isPast && (
              <UpcomingCharges
                summary={summary}
                templates={templates}
                billingDay={billingDay}
                onManage={() => setShowCommitments(true)}
              />
            )}

            {!isPast && <EndingSoon items={ending} />}

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
              onDeposit={(amount) => openSheet('fund', '', amount, true)}
              entries={byCategory.unplanned}
              authorOf={shared ? members.get : null}
              actions={actions}
              onAdd={openSheet}
              onStopRecurring={setPendingStop}
            />

            <div className="budget-actions">
              <button type="button" className="btn-text" onClick={() => setShowCommitments(true)}>
                חיובים קבועים
              </button>
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
          fromRemainder={sheet.fromRemainder}
          initialRecurring={sheet.recurring}
          month={month}
          groups={groups}
          initialAmount={prefill}
          summary={summary}
          me={me}
          partner={partner ? displayName(partner) : ''}
          onSubmit={actions.add}
          onClose={() => { setSheet(null); setPrefill(0) }}
        />
      )}

      {showCommitments && (
        <Commitments
          budgetId={budgetId}
          templates={templates}
          month={month}
          onStop={(template) => { setShowCommitments(false); setPendingStop(template) }}
          onAdd={() => { setShowCommitments(false); openSheet('fixed', '', 0, false, true) }}
          onClose={() => setShowCommitments(false)}
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

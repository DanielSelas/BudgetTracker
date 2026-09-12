import { useMemo, useState } from 'react'
import CategoryCard from './CategoryCard'
import SummaryCard from './SummaryCard'
import UnplannedCard from './UnplannedCard'
import MonthPicker from './MonthPicker'
import EntrySheet from './EntrySheet'
import ConfirmDialog from './ConfirmDialog'
import { useEntries, entryActions } from '../hooks/useEntries'
import { useRecurring } from '../hooks/useRecurring'
import { createTemplate, skipMonth, stopTemplate } from '../lib/recurring'
import { CATEGORIES, monthKey, summarizeMonth } from '../lib/model'
import { displayName, memberIndex } from '../lib/members'

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

export default function MonthView({ budgetId, budget, uid }) {
  const [month, setMonth] = useState(monthKey)
  const [sheet, setSheet] = useState(null)
  const [pendingStop, setPendingStop] = useState(null)
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

  const summary = useMemo(() => summarizeMonth(entries), [entries])
  const members = useMemo(() => memberIndex(budget?.members), [budget?.members])
  const me = members.get(uid)
  const partner = members.sorted.find((member) => member.uid !== uid)
  const shared = members.sorted.length > 1

  const failure = error || recurringError

  return (
    <>
      <div className="sticky-head">
        <MonthPicker
          month={month}
          onChange={setMonth}
          subtitle={budget ? `${budget.name} · ${shared ? 'משותף' : 'אישי'}` : ''}
        />
      </div>

      <div className="app-scroll">
        {failure && (
          <p className="notice block" role="alert">
            שגיאה בטעינת הנתונים: <code>{failure.code || 'unknown'}</code>
          </p>
        )}

        {loading ? <Skeleton /> : (
          <>
            <SummaryCard summary={summary} />
            <UnplannedCard summary={summary} />

            {ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                entries={byCategory[category]}
                group={summary.groups[CATEGORIES[category].budgetGroup]}
                authorOf={shared ? members.get : null}
                actions={actions}
                onAdd={(next) => setSheet(next)}
                onStopRecurring={setPendingStop}
              />
            ))}
          </>
        )}
      </div>

      <button type="button" className="fab" onClick={() => setSheet('fixed')}>
        <span className="plus">+</span> הוצאה
      </button>

      {sheet && (
        <EntrySheet
          initialCategory={sheet}
          summary={summary}
          me={me}
          partner={partner ? displayName(partner) : ''}
          onSubmit={actions.add}
          onClose={() => setSheet(null)}
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

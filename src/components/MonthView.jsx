import { useMemo, useState } from 'react'
import CategoryCard from './CategoryCard'
import SummaryCard from './SummaryCard'
import UnplannedCard from './UnplannedCard'
import MonthPicker from './MonthPicker'
import { useEntries, entryActions } from '../hooks/useEntries'
import { useRecurring } from '../hooks/useRecurring'
import { createTemplate, skipMonth, stopTemplate } from '../lib/recurring'
import { CATEGORIES, monthKey, summarizeMonth } from '../lib/model'

const ORDER = ['income', 'fixed', 'leisure', 'fund']

export default function MonthView({ budgetId, uid }) {
  const [month, setMonth] = useState(monthKey)
  const { byCategory, entries, loading, error } = useEntries(budgetId, month)

  const base = useMemo(
    () => entryActions({ budgetId, month, uid }),
    [budgetId, month, uid],
  )
  const { error: recurringError } = useRecurring({
    budgetId, month, uid, entries, entriesLoaded: !loading,
  })

  const actions = useMemo(() => ({
    ...base,
    add: async ({ recurring, ...values }) => {
      if (!recurring) return base.add(values)
      // התבנית היא המקור; השורה של החודש הזה תיווצר ממנה אוטומטית
      return createTemplate({ budgetId, uid, month, ...values })
    },
    // מחיקת שורה שנוצרה מתבנית מדלגת על החודש הזה בלבד,
    // אחרת היא הייתה נוצרת מחדש מיד בכניסה הבאה לחודש.
    remove: async (entryId, entry) => {
      if (entry?.recurringId) await skipMonth(budgetId, entry.recurringId, month)
      return base.remove(entryId)
    },
    stopRecurring: (recurringId) => stopTemplate(budgetId, recurringId),
  }), [base, budgetId, month, uid])
  const summary = useMemo(() => summarizeMonth(entries), [entries])

  function handleStopRecurring(entry) {
    const message = `להפסיק את "${entry.name}" כחיוב קבוע?\n\nהשורה של ${month} והחודשים הקודמים תישאר, אבל הוא לא יתווסף יותר בחודשים הבאים.`
    if (window.confirm(message)) actions.stopRecurring(entry.recurringId)
  }

  return (
    <>
      <MonthPicker month={month} onChange={setMonth} />

      {(error || recurringError) && (
        <p className="error card" role="alert">
          שגיאה בטעינת הנתונים: <code>{(error || recurringError).code || 'unknown'}</code>
        </p>
      )}

      {loading ? (
        <p className="card">טוען...</p>
      ) : (
        <>
          <SummaryCard summary={summary} />
          <UnplannedCard summary={summary} />

          {ORDER.map((category) => (
            <CategoryCard
              key={category}
              category={category}
              entries={byCategory[category]}
              group={summary.groups[CATEGORIES[category].budgetGroup]}
              actions={actions}
              onStopRecurring={handleStopRecurring}
            />
          ))}
        </>
      )}
    </>
  )
}

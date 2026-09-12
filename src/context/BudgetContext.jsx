import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { watchBudget, watchMembers, watchMemberships } from '../lib/budgets'
import { useAuth } from './AuthContext'

const BudgetContext = createContext(null)
const STORAGE_KEY = 'budgettracker:selectedBudgetId'

function storeBudgetId(budgetId) {
  try {
    if (budgetId) localStorage.setItem(STORAGE_KEY, budgetId)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // מצב פרטי בדפדפן, הבחירה פשוט לא תישמר בין ביקורים
  }
}

export function BudgetProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid

  const [budgetIds, setBudgetIds] = useState(null)
  const [budgetsById, setBudgetsById] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [membersById, setMembersById] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uid) return
    setBudgetIds(null)
    return watchMemberships(uid, setBudgetIds, setError)
  }, [uid])

  // מסמך התקציב עצמו חי בנפרד מהאינדקס האישי, ולכן נדרשת האזנה לכל אחד.
  useEffect(() => {
    if (!budgetIds) return
    const unsubscribers = budgetIds.map((budgetId) =>
      watchBudget(
        budgetId,
        (budget) =>
          setBudgetsById((current) => ({ ...current, [budgetId]: budget })),
        setError,
      ),
    )
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [budgetIds])

  // מספר החברים הוא ההבדל בין תקציב אישי למשותף, ולכן נדרש לדף הבית
  useEffect(() => {
    if (!budgetIds) return
    const unsubscribers = budgetIds.map((budgetId) =>
      watchMembers(
        budgetId,
        (members) => setMembersById((current) => ({ ...current, [budgetId]: members })),
        () => {},
      ),
    )
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [budgetIds])

  const budgets = useMemo(
    () => (budgetIds || [])
      .map((id) => (budgetsById[id] ? { ...budgetsById[id], members: membersById[id] ?? null } : null))
      .filter(Boolean),
    [budgetIds, budgetsById, membersById],
  )

  // null = דף הבית. בחירה שאיננה תקפה יותר (עזיבה, מחיקה) חוזרת לשם.
  const activeId = budgetIds?.includes(selectedId) ? selectedId : null

  useEffect(() => {
    storeBudgetId(activeId)
  }, [activeId])

  const value = useMemo(
    () => ({
      budgets,
      budgetIds,
      loading: budgetIds === null,
      hasNoBudgets: budgetIds?.length === 0,
      budgetId: activeId,
      budget: activeId
        ? (budgetsById[activeId]
            ? { ...budgetsById[activeId], members: membersById[activeId] ?? null }
            : null)
        : null,
      selectBudget: setSelectedId,
      goHome: () => setSelectedId(null),
      error,
    }),
    [budgets, budgetIds, activeId, budgetsById, membersById, error],
  )

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudget() {
  const context = useContext(BudgetContext)
  if (!context) throw new Error('useBudget must be used within a BudgetProvider')
  return context
}

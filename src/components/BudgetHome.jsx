import { useState } from 'react'
import BudgetSetup from './BudgetSetup'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'

function BudgetBadge({ members }) {
  if (!members) return <span className="badge-static loading">טוען...</span>
  const shared = members.length > 1
  return (
    <span className={`badge-static ${shared ? 'shared' : 'personal'}`}>
      {shared ? `👥 משותף · ${members.length}` : '👤 אישי'}
    </span>
  )
}

export default function BudgetHome() {
  const { user, signOut } = useAuth()
  const { budgets, selectBudget } = useBudget()
  const [adding, setAdding] = useState(false)

  return (
    <main className="app">
      <header className="topbar">
        <h1>התקציבים שלי</h1>
        <button type="button" className="secondary" onClick={signOut}>התנתקות</button>
      </header>

      <ul className="budget-list">
        {budgets.map((budget) => (
          <li key={budget.id}>
            <button type="button" className="budget-card" onClick={() => selectBudget(budget.id)}>
              <span className="budget-name">{budget.name}</span>
              <BudgetBadge members={budget.members} />
              {budget.ownerUid === user.uid && <span className="hint">נוצר על ידך</span>}
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <BudgetSetup canCancel onDone={(budgetId) => {
          setAdding(false)
          if (budgetId) selectBudget(budgetId)
        }} />
      ) : (
        <button type="button" className="secondary" onClick={() => setAdding(true)}>
          + תקציב נוסף או הצטרפות עם קוד
        </button>
      )}

      <p className="hint center">מחובר כ-{user.email}</p>
    </main>
  )
}

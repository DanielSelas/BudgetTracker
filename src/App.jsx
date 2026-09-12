import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BudgetProvider, useBudget } from './context/BudgetContext'
import Login from './components/Login'
import BudgetSetup from './components/BudgetSetup'
import InvitePanel from './components/InvitePanel'
import { isFirebaseConfigured, missingFirebaseKeys } from './lib/firebase'
import MonthView from './components/MonthView'
import HistoryView from './components/HistoryView'
import BudgetHome from './components/BudgetHome'
import UpdatePrompt from './components/UpdatePrompt'
import OfflineBanner from './components/OfflineBanner'
import './App.css'

function ConfigError() {
  return (
    <main className="app">
      <h1>BudgetTracker</h1>
      <section className="card">
        <p>❌ חסרות הגדרות Firebase בקובץ <code>.env.local</code>:</p>
        <ul>{missingFirebaseKeys.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
      </section>
    </main>
  )
}

function Onboarding() {
  return (
    <main className="app">
      <h1>BudgetTracker</h1>
      <p className="subtitle">צור תקציב חדש, או הצטרף לתקציב קיים עם קוד הזמנה.</p>
      <BudgetSetup />
    </main>
  )
}

function Workspace() {
  const { user } = useAuth()
  const { budget, budgetId, goHome } = useBudget()
  const [showInvite, setShowInvite] = useState(false)
  const [tab, setTab] = useState('month')

  return (
    <main className="app">
      <header className="topbar">
        <button type="button" className="secondary icon" aria-label="חזרה לתקציבים" onClick={goHome}>
          →
        </button>
        <h1>{budget?.name || 'BudgetTracker'}</h1>
        <div className="topbar-actions">
          <button type="button" className="secondary" onClick={() => setShowInvite((on) => !on)}>
            {showInvite ? 'סגור' : 'הזמנה'}
          </button>
        </div>
      </header>

      {showInvite && <InvitePanel budgetId={budgetId} />}

      <nav className="tabs-main">
        <button
          type="button"
          className={tab === 'month' ? '' : 'secondary'}
          onClick={() => setTab('month')}
        >
          החודש
        </button>
        <button
          type="button"
          className={tab === 'history' ? '' : 'secondary'}
          onClick={() => setTab('history')}
        >
          היסטוריה
        </button>
      </nav>

      {tab === 'month'
        ? <MonthView budgetId={budgetId} uid={user.uid} />
        : <HistoryView budgetId={budgetId} />}

    </main>
  )
}

function BudgetGate() {
  const { loading, hasNoBudgets, budgetId } = useBudget()
  if (loading) return <main className="app"><p>טוען תקציבים...</p></main>
  if (hasNoBudgets) return <Onboarding />
  if (!budgetId) return <BudgetHome />
  return <Workspace />
}

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <main className="app"><p>טוען...</p></main>
  if (!user) return <Login />
  return (
    <BudgetProvider>
      <BudgetGate />
    </BudgetProvider>
  )
}

export default function App() {
  if (!isFirebaseConfigured) return <ConfigError />
  return (
    <AuthProvider>
      <OfflineBanner />
      <AuthGate />
      <UpdatePrompt />
    </AuthProvider>
  )
}

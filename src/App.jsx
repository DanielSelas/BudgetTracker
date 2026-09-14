import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BudgetProvider, useBudget } from './context/BudgetContext'
import Login from './components/Login'
import BudgetSetup from './components/BudgetSetup'
import BudgetHome from './components/BudgetHome'
import MonthView from './components/MonthView'
import TripView from './components/TripView'
import GoalView from './components/GoalView'
import HistoryView from './components/HistoryView'
import BottomNav from './components/BottomNav'
import UpdatePrompt from './components/UpdatePrompt'
import OfflineBanner from './components/OfflineBanner'
import ErrorBoundary from './components/ErrorBoundary'
import Migration from './components/Migration'
import Welcome, { seenIntro } from './components/Welcome'
import { isFirebaseConfigured, missingFirebaseKeys } from './lib/firebase'
import { clearNudge, readNudge } from './lib/deepLink'
import { budgetType, isGoal, isTrip } from './lib/model'
import './App.css'

function ConfigError() {
  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head"><h1>BudgetTracker</h1></header>
        <p className="notice block">חסרות הגדרות Firebase בקובץ <code>.env.local</code>:</p>
        <ul>{missingFirebaseKeys.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
      </div>
    </main>
  )
}

function Loading({ label }) {
  return (
    <main className="app">
      <div className="app-scroll">
        <div className="skeleton" style={{ height: 120, marginTop: 24 }} />
        <div className="skeleton" style={{ height: 200 }} />
        <span className="hint center">{label}</span>
      </div>
    </main>
  )
}

function Onboarding() {
  const { selectBudget } = useBudget()
  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <h1>בואו נתחיל</h1>
            <p className="muted">צרו תקציב חדש, או הצטרפו לקיים עם קוד הזמנה.</p>
          </div>
        </header>
        <BudgetSetup onDone={(budgetId) => budgetId && selectBudget(budgetId)} />
      </div>
    </main>
  )
}

function Workspace({ nudge }) {
  const { user } = useAuth()
  const { budget, budgetId, goHome } = useBudget()
  const [tab, setTab] = useState('month')
  const trip = isTrip(budget)
  const goal = isGoal(budget)
  // ההסבר מדבר על 50/30/20 ועל בלת״ם, ולכן אין לו מה לומר
  // במסך של טיול או מטרה
  const [intro, setIntro] = useState(() => !seenIntro())

  function handleNav(next) {
    if (next === 'budgets') goHome()
    else setTab(next)
  }

  return (
    <main className="app">
      {goal
        ? <GoalView budgetId={budgetId} budget={budget} uid={user.uid} onDeleted={goHome} />
        : trip
        ? <TripView budgetId={budgetId} budget={budget} uid={user.uid} onDeleted={goHome} />
        : tab === 'month'
          ? <MonthView budgetId={budgetId} budget={budget} uid={user.uid} nudge={nudge} onDeleted={goHome} />
          : <HistoryView budgetId={budgetId} />}
      <BottomNav active={tab} onChange={handleNav} type={budgetType(budget)} />
      {intro && !trip && !goal && <Welcome onClose={() => setIntro(false)} />}
    </main>
  )
}

function Home() {
  const { selectBudget, budgets } = useBudget()
  return (
    <main className="app">
      <BudgetHome />
      <BottomNav
        active="budgets"
        onChange={(next) => {
          if (next !== 'budgets' && budgets[0]) selectBudget(budgets[0].id)
        }}
      />
    </main>
  )
}

function BudgetGate() {
  const { loading, hasNoBudgets, budgetId, budgetIds, selectBudget } = useBudget()
  const [nudge, setNudge] = useState(readNudge)

  // קישור מהתראה פותח את התקציב הנכון, ומיד מנוקה מהכתובת
  useEffect(() => {
    if (!nudge?.budgetId || !budgetIds) return
    if (budgetIds.includes(nudge.budgetId)) selectBudget(nudge.budgetId)
    else setNudge(null)
    clearNudge()
  }, [nudge, budgetIds, selectBudget])

  if (loading) return <Loading label="טוען תקציבים" />
  if (hasNoBudgets) return <Onboarding />
  if (!budgetId) return <Home />
  return <Workspace nudge={nudge} />
}

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <Loading label="מתחבר" />
  if (!user) return <Login />
  return (
    <BudgetProvider>
      {/* כלי חד פעמי, מאחורי כתובת ולא מאחורי כפתור: אין סיבה
          שהוא יופיע במסלול של מישהו שרק רוצה להזין הוצאה */}
      {window.location.hash === '#migrate' ? <Migration /> : <BudgetGate />}
    </BudgetProvider>
  )
}

export default function App() {
  if (!isFirebaseConfigured) return <ConfigError />
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate />
        <OfflineBanner />
        <UpdatePrompt />
      </AuthProvider>
    </ErrorBoundary>
  )
}

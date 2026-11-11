import { useEffect, useMemo, useState } from 'react'
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
import Maintenance from './components/Maintenance'
import Welcome, { seenIntro } from './components/Welcome'
import { isFirebaseConfigured, missingFirebaseKeys } from './lib/firebase'
import { clearDeepLink, readCapture, readNudge } from './lib/deepLink'
import { useOwnProfile } from './hooks/useOwnProfile'
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

function Workspace({ nudge, capture }) {
  const { user } = useAuth()
  const { budget, budgetId, goHome } = useBudget()
  const [tab, setTab] = useState('month')
  const trip = isTrip(budget)
  const goal = isGoal(budget)
  // לכל סוג תקציב הסבר משלו, ולכן גם סימון נפרד של מי שכבר נראה
  const kind = budgetType(budget)
  const [intro, setIntro] = useState(() => !seenIntro(kind))

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
          ? <MonthView budgetId={budgetId} budget={budget} uid={user.uid} nudge={nudge} capture={capture} onBack={goHome} onDeleted={goHome} />
          : <HistoryView budgetId={budgetId} fixedBase={budget?.baseAmount} />}
      <BottomNav active={tab} onChange={handleNav} type={budgetType(budget)} />
      {intro && <Welcome kind={kind} onClose={() => setIntro(false)} />}
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
  const { loading, hasNoBudgets, budgetId, budgetIds, budgets, selectBudget } = useBudget()
  // שני הפרמטרים נקראים כאן ולא בכל רכיב בנפרד, כי הניקוי מוחק את
  // הכתובת כולה: קריאה מאוחרת של אחד מהם הייתה מגיעה אחרי שהשני ניקה
  const [nudge, setNudge] = useState(readNudge)
  const [capture, setCapture] = useState(readCapture)
  const target = nudge?.budgetId || capture?.budgetId

  /**
   * איפה קליטה מהקיצור נוחתת כשלא נאמר תקציב.
   *
   * חייב להיות תקציב משק בית, כי רק לו יש מסך חודש ורק שם מוצגת
   * התיבה. בלי הבחירה הזו הקליטה נבלעה בשקט בכל מצב שאינו מסך החודש:
   * דפדפן חדש שנפתח על רשימת התקציבים, או תקציב טיול שהיה האחרון
   * שנפתח. הדפדפן נפתח, שום דבר לא קרה, ואין מה לראות.
   */
  const landing = useMemo(() => {
    if (!capture) return null
    const households = budgets.filter((item) => budgetType(item) === 'household')
    // התקציב שכבר פתוח מנצח, כדי שקליטה לא תקפיץ אותך לתקציב אחר
    return households.some((item) => item.id === budgetId)
      ? budgetId
      : households[0]?.id || null
  }, [capture, budgets, budgetId])

  // קישור מהתראה או מקיצור פותח את התקציב הנכון, ומיד מנוקה מהכתובת
  useEffect(() => {
    if (!budgetIds || (!nudge && !capture)) return
    clearDeepLink()

    if (target) {
      if (budgetIds.includes(target)) selectBudget(target)
      else {
        // תקציב שאינו שלנו: אין לאן לכתוב, ולכן הקישור נזרק במקום
        // להיקלט לתקציב שסתם היה פתוח
        setNudge(null)
        setCapture(null)
      }
      return
    }

    if (landing && landing !== budgetId) selectBudget(landing)
  }, [nudge, capture, target, landing, budgetId, budgetIds, selectBudget])

  if (loading) return <Loading label="טוען תקציבים" />
  if (hasNoBudgets) return <Onboarding />
  if (!budgetId) return <Home />
  return <Workspace nudge={nudge} capture={capture} />
}

function AuthGate() {
  const { user, loading } = useAuth()
  // יוצר את הפרופיל בכניסה הראשונה, כדי שלכל משתמש יהיה שם
  useOwnProfile(user)
  if (loading) return <Loading label="מתחבר" />
  if (!user) return <Login />
  return (
    <BudgetProvider>
      {window.location.hash === '#maintenance' ? <Maintenance /> : <BudgetGate />}
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

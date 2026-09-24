import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { useProfiles } from '../hooks/useProfiles'
import ProfileSheet from './ProfileSheet'
import BudgetSetup from './BudgetSetup'
import NotificationCard from './NotificationCard'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { displayName, membersSentence, sortMembers } from '../lib/members'
import { isFrameBudget, isGoal, monthKey } from '../lib/model'
import { useMonthBalance, useFrameTotal } from '../hooks/useBudgetBalance'
import { monthLabel, shekels } from '../lib/format'

function Remaining({ budget }) {
  const frame = isFrameBudget(budget)
  const goal = isGoal(budget)
  // שני ה-hooks נקראים תמיד, ומי שלא רלוונטי מקבל null ולא מאזין לכלום
  const balance = useMonthBalance(frame ? null : budget.id, budget.baseAmount)
  const spent = useFrameTotal(frame ? budget.id : null, goal)

  if (frame) {
    if (spent === null) return null
    return goal ? (
      <span className="budget-remaining">
        נחסך <strong className="num">{shekels(spent)}</strong>
        {' '}מתוך {shekels(budget.frame || 0)}
      </span>
    ) : (
      <span className="budget-remaining">
        נשאר מהמסגרת <strong className="num">{shekels((budget.frame || 0) - spent)}</strong>
      </span>
    )
  }

  if (balance === null) return null
  // הפס מראה כמה מההכנסה כבר נוצל. בלי הכנסה אין ממה לחשב אחוז,
  // ואז אין פס במקום פס ריק שנראה כמו נתון
  const used = balance.income > 0
    ? Math.max(0, Math.min(100, (balance.expenses / balance.income) * 100))
    : null

  return (
    <>
      <span className="budget-row">
        <span className="stack-title">
          <span className="budget-cap">נשאר ב{monthLabel(monthKey())}</span>
          <span className="budget-balance num">{shekels(balance.balance)}</span>
        </span>
        {balance.income > 0 && (
          <span className="budget-cap num">מתוך {shekels(balance.income)}</span>
        )}
      </span>

      {used !== null && (
        <span className="bar">
          <span className="bar-fill used" style={{ width: `${used}%` }} />
        </span>
      )}
    </>
  )
}

/**
 * מי רואה את התקציב.
 *
 * במשותף אווטארים חופפים, ובאישי שתי מילים. שורת שמות מלאה חזרה
 * על מה שהאווטארים כבר אומרים, ותפסה את המקום של היתרה.
 */
function Members({ budget, profiles }) {
  const members = sortMembers(budget.members)
  if (!budget.members) return null
  if (members.length < 2) return <span className="only-you">רק אתה</span>

  return (
    <span className="avatar-stack" title={membersSentence(members, profiles)}>
      {members.map((member, index) => (
        <Avatar key={member.uid} member={member} profile={profiles[member.uid]} stacked={index > 0} />
      ))}
    </span>
  )
}

/** קבוצה של תקציבים תחת כותרת. קבוצה ריקה אינה מוצגת כלל. */
function Group({ title, budgets, profiles, onOpen }) {
  if (budgets.length === 0) return null
  return (
    <>
      <h2 className="group-title">{title}</h2>
      <ul className="budget-list">
        {budgets.map((budget) => (
          <li key={budget.id}>
            <button type="button" className="budget-card" onClick={() => onOpen(budget.id)}>
              <span className="budget-card-top">
                <span className="budget-name">{budget.name}</span>
                <Members budget={budget} profiles={profiles} />
              </span>
              <Remaining budget={budget} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function BudgetHome() {
  const { user, signOut } = useAuth()
  const { budgets, selectBudget } = useBudget()
  // הפרופילים של כל מי שמופיע באיזשהו תקציב, לשם ולצבע אחידים
  const memberUids = useMemo(
    () => budgets.flatMap((budget) => (budget.members || []).map((member) => member.uid)),
    [budgets],
  )
  const profiles = useProfiles(memberUids)
  const [adding, setAdding] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)

  // משותף לפי מספר החברים בפועל, ולא לפי סוג התקציב
  const shared = budgets.filter((budget) => (budget.members?.length ?? 1) > 1)
  const personal = budgets.filter((budget) => (budget.members?.length ?? 1) <= 1)

  return (
    <>
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <p className="muted">
              שלום, {displayName({ uid: user.uid, email: user.email }, profiles[user.uid])}
            </p>
            <h1>התקציבים שלי</h1>
          </div>
          {/* טקסט ולא סמל: ל-↪ יש גרסת אימוג׳י, ו-iOS צבע אותו כאימוג׳י
              בתוך ממשק שכולו טיפוגרפי */}
          <div className="head-actions">
            <button type="button" className="btn-text quiet" onClick={() => setEditingProfile(true)}>
              הפרופיל שלי
            </button>
            <button type="button" className="btn-text quiet" onClick={signOut}>
              התנתקות
            </button>
          </div>
        </header>

        <Group title="משותפים" budgets={shared} profiles={profiles} onOpen={selectBudget} />
        <Group title="אישי" budgets={personal} profiles={profiles} onOpen={selectBudget} />

        <NotificationCard />
      </div>

      {/* שתי הפעולות צמודות לתחתית, כי הן מה שעושים כאן כשאין תקציב
          לפתוח, והרשימה שמעליהן גדלה עם הזמן */}
      <div className="home-actions">
        <button type="button" className="btn-primary" onClick={() => setAdding('create')}>
          תקציב חדש
        </button>
        <button type="button" className="btn-secondary" onClick={() => setAdding('join')}>
          הצטרפות עם קוד
        </button>
      </div>

      {editingProfile && (
        <ProfileSheet
          profile={profiles[user.uid]}
          onClose={() => setEditingProfile(false)}
        />
      )}

      {adding && (
        <BudgetSetup
          asSheet
          initialMode={adding}
          onClose={() => setAdding('')}
          onDone={(budgetId) => {
            setAdding('')
            if (budgetId) selectBudget(budgetId)
          }}
        />
      )}
    </>
  )
}

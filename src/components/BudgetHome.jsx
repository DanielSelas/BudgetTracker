import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { useProfiles } from '../hooks/useProfiles'
import ProfileSheet from './ProfileSheet'
import BudgetSetup from './BudgetSetup'
import NotificationCard from './NotificationCard'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { displayName, membersSentence, sortMembers } from '../lib/members'
import { BUDGET_TYPES, budgetType, isFrameBudget, isGoal } from '../lib/model'
import { useMonthBalance, useFrameTotal } from '../hooks/useBudgetBalance'
import { shekels } from '../lib/format'

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
  return (
    <span className="budget-remaining">
      נשאר החודש <strong className="num">{shekels(balance)}</strong>
    </span>
  )
}

function MemberRow({ budget, isOwner, profiles }) {
  const members = sortMembers(budget.members)
  if (!budget.members) return <span className="member-row">טוען...</span>

  return (
    <span className="member-row">
      {members.map((member, index) => (
        <Avatar key={member.uid} member={member} profile={profiles[member.uid]} stacked={index > 0} />
      ))}
      <span className="names">
        {members.length > 1 ? membersSentence(members, profiles) : 'רק אתה רואה אותו'}
        {isOwner ? ' · נוצר על ידך' : ''}
      </span>
    </span>
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
  const [adding, setAdding] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)

  return (
    <>
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <h1>התקציבים שלי</h1>
            <p className="muted">{displayName({ uid: user.uid, email: user.email }, profiles[user.uid])}</p>
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

        <ul className="budget-list">
          {budgets.map((budget) => {
            const shared = (budget.members?.length ?? 1) > 1
            const isOwner = budget.ownerUid === user.uid
            return (
              <li key={budget.id}>
                <button
                  type="button"
                  className={`budget-card ${shared ? 'shared' : ''}`}
                  onClick={() => selectBudget(budget.id)}
                >
                  <span className="budget-card-top">
                    <span className="budget-name">{budget.name}</span>
                    <span className="tag-row">
                      <span className="tag quiet">{BUDGET_TYPES[budgetType(budget)].label}</span>
                      <span className={`tag ${shared ? 'shared' : ''}`}>
                        {budget.members
                          ? shared ? `משותף · ${budget.members.length}` : 'אישי'
                          : 'טוען...'}
                      </span>
                    </span>
                  </span>

                  <MemberRow budget={budget} isOwner={isOwner} profiles={profiles} />
                  <Remaining budget={budget} />
                </button>
              </li>
            )
          })}
        </ul>

        <button type="button" className="dashed-card" onClick={() => setAdding(true)}>
          + תקציב חדש או הצטרפות עם קוד
        </button>

        <NotificationCard />

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
          onClose={() => setAdding(false)}
          onDone={(budgetId) => {
            setAdding(false)
            if (budgetId) selectBudget(budgetId)
          }}
        />
      )}
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import BudgetSetup from './BudgetSetup'
import InvitePanel from './InvitePanel'
import NotificationCard from './NotificationCard'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { membersSentence, sortMembers } from '../lib/members'
import { BUDGET_TYPES, budgetType, isFrameBudget, isGoal } from '../lib/model'
import { useMonthBalance, useFrameTotal } from '../hooks/useBudgetBalance'
import { shekels } from '../lib/format'

function Remaining({ budget }) {
  const frame = isFrameBudget(budget)
  const goal = isGoal(budget)
  // שני ה-hooks נקראים תמיד, ומי שלא רלוונטי מקבל null ולא מאזין לכלום
  const balance = useMonthBalance(frame ? null : budget.id)
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

function MemberRow({ budget, isOwner }) {
  const members = sortMembers(budget.members)
  if (!budget.members) return <span className="member-row">טוען...</span>

  return (
    <span className="member-row">
      {members.map((member, index) => (
        <Avatar key={member.uid} member={member} index={index} stacked={index > 0} />
      ))}
      <span className="names">
        {members.length > 1 ? membersSentence(members) : 'רק אתה רואה אותו'}
        {isOwner ? ' · נוצר על ידך' : ''}
      </span>
    </span>
  )
}

export default function BudgetHome() {
  const { user, signOut } = useAuth()
  const { budgets, selectBudget } = useBudget()
  const [adding, setAdding] = useState(false)
  const [inviteFor, setInviteFor] = useState(null)

  const target = useMemo(
    () => budgets.find((budget) => budget.id === inviteFor) ?? budgets[0] ?? null,
    [budgets, inviteFor],
  )

  useEffect(() => {
    if (!inviteFor && budgets.length === 1) setInviteFor(budgets[0].id)
  }, [budgets, inviteFor])

  return (
    <>
      <div className="app-scroll">
        <header className="screen-head">
          <div>
            <h1>התקציבים שלי</h1>
            <p className="muted">{user.email}</p>
          </div>
          <button type="button" className="btn-round" aria-label="התנתקות" onClick={signOut}>
            ↪
          </button>
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

                  <MemberRow budget={budget} isOwner={isOwner} />
                  <Remaining budget={budget} />
                </button>

                {budgets.length > 1 && (
                  <div className="invite-actions">
                    <button
                      type="button"
                      className="chip-button"
                      onClick={() => setInviteFor(budget.id)}
                    >
                      הזמנה לתקציב הזה
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <button type="button" className="dashed-card" onClick={() => setAdding(true)}>
          + תקציב חדש או הצטרפות עם קוד
        </button>

        <NotificationCard />

        {target && (
          <InvitePanel
            budgetId={target.id}
            budgetName={target.name}
            showName={budgets.length > 1}
          />
        )}
      </div>

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

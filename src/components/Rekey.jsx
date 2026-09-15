import { useMemo, useState } from 'react'
import InvitePanel from './InvitePanel'
import { useAuth } from '../context/AuthContext'
import { useBudget } from '../context/BudgetContext'
import { displayName } from '../lib/members'
import { useProfiles } from '../hooks/useProfiles'
import {
  alreadyReadable, copyContent, createTarget, finishRekey, proposedId, verifyRekey,
} from '../lib/rekey'

/**
 * החלפת המזהים האקראיים של תקציבים קיימים במזהים קריאים.
 *
 * תקציב אחד בכל פעם, בארבעה שלבים, כי אמצע התהליך דורש פעולה של
 * שותף. תקציב שאתם לבד בו עובר ברצף.
 */
export default function Rekey() {
  const { user } = useAuth()
  const { budgets } = useBudget()
  const profiles = useProfiles([user.uid])
  const [active, setActive] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState({})

  const pending = useMemo(
    () => (budgets || []).filter((budget) => !alreadyReadable(budget.id)),
    [budgets],
  )

  const current = pending.find((budget) => budget.id === active) || null
  const step = state[active] || {}
  const others = (current?.members || []).filter((member) => member.uid !== user.uid)
  const joined = step.newId
    ? (budgets.find((budget) => budget.id === step.newId)?.members?.length ?? 1)
    : 0
  const everyoneJoined = joined >= (current?.members?.length ?? 1)

  async function guard(name, work) {
    setBusy(name)
    setError('')
    try {
      await work()
    } catch (failure) {
      setError(`${failure?.message || 'נכשל'}${failure?.code ? ` (${failure.code})` : ''}`)
    }
    setBusy('')
  }

  const create = () => guard('create', async () => {
    const newId = await createTarget({
      budget: current,
      uid: user.uid,
      displayName: displayName({ uid: user.uid, email: user.email }, profiles[user.uid]),
    })
    setState((all) => ({ ...all, [active]: { newId } }))
  })

  const copy = () => guard('copy', async () => {
    const counts = await copyContent({ oldId: active, newId: step.newId })
    setState((all) => ({ ...all, [active]: { ...all[active], counts, check: null } }))
  })

  const verify = () => guard('verify', async () => {
    const check = await verifyRekey({ oldId: active, newId: step.newId })
    setState((all) => ({ ...all, [active]: { ...all[active], check } }))
  })

  const finish = () => guard('finish', async () => {
    await finishRekey({ oldId: active, newId: step.newId, uid: user.uid, budgets })
    setState((all) => ({ ...all, [active]: { ...all[active], done: true } }))
    setActive(null)
  })

  if (pending.length === 0) {
    return (
      <section className="cat-card">
        <div className="cat-head">
          <span className="cat-title"><h2>מזהים קריאים</h2></span>
        </div>
        <p className="hint">לכל התקציבים כבר יש מזהה קריא. אין מה לעשות כאן.</p>
      </section>
    )
  }

  return (
    <section className="cat-card">
      <div className="cat-head">
        <span className="cat-title"><h2>מזהים קריאים</h2></span>
        <span className="cat-total num">{pending.length}</span>
      </div>

      <p className="hint">
        תקציב אחד בכל פעם. שום דבר לא נמחק עד שהאימות עובר.
      </p>

      <ul className="entry-list">
        {pending.map((budget) => (
          <li className="entry-row" key={budget.id}>
            <button
              type="button"
              className="entry-name as-button"
              onClick={() => setActive(budget.id === active ? null : budget.id)}
            >
              {budget.name}
            </button>
            <span className="recurring-tag as-tag">{budget.type || 'household'}</span>
            <code className="tiny-id">{budget.id}</code>
            <span className="recurring-tag as-tag">
              {(budget.members?.length ?? 1) > 1 ? 'משותף' : 'אישי'}
            </span>
          </li>
        ))}
      </ul>

      {current && (
        <div className="subsection">
          <h3>{current.name}</h3>

          <p className="hint">
            המזהה הנוכחי בקונסולה: <code>{current.id}</code>
          </p>
          <p className="hint">
            המזהה החדש יהיה <code>{step.newId || proposedId(current)}</code>
          </p>

          <button type="button" className="btn-primary" disabled={!!step.newId || busy === 'create'} onClick={create}>
            {busy === 'create' ? 'יוצר...' : step.newId ? 'נוצר ✓' : '1. יצירת התקציב החדש'}
          </button>

          {step.newId && others.length > 0 && (
            <>
              <p className="hint">
                2. {others.map((member) => displayName(member)).join(', ')} צריכים להצטרף
                לתקציב החדש עם הקוד הזה, אחרת השורות שהם הזינו יידחו.
                הצטרפו {joined} מתוך {current.members.length}.
              </p>
              <InvitePanel budgetId={step.newId} budgetName={current.name} heading="קוד לתקציב החדש" />
            </>
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={!step.newId || !everyoneJoined || busy === 'copy'}
            onClick={copy}
          >
            {busy === 'copy' ? 'מעתיק...' : '3. העתקת התוכן'}
          </button>
          {step.counts && (
            <p className="hint">
              הועתקו {step.counts.entries} שורות ו-{step.counts.templates} חיובים קבועים.
            </p>
          )}

          <button type="button" className="btn-primary" disabled={!step.counts || busy === 'verify'} onClick={verify}>
            {busy === 'verify' ? 'בודק...' : '4. אימות'}
          </button>
          {step.check && (
            <p className="hint">
              שורות: ישן {step.check.oldEntries}, חדש {step.check.newEntries}.
              חברים: ישן {step.check.oldMembers}, חדש {step.check.newMembers}.
              {step.check.ok ? ' תקין ✓' : ' יש פער ✗'}
            </p>
          )}

          <button
            type="button"
            className="btn-text danger-text"
            disabled={!step.check?.ok || busy === 'finish'}
            onClick={finish}
          >
            {busy === 'finish' ? 'מסיים...' : '5. מחיקת התקציב הישן'}
          </button>

          {error && <p className="notice block" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

const MIN_PASSWORD = 6

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const registering = mode === 'signup'

  function switchTo(next) {
    setMode(next)
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // נבדק כאן ולא רק בשרת, כדי לא לשלוח בקשה שתיכשל בוודאות
    if (registering && password.length < MIN_PASSWORD) {
      setError(`הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים`)
      return
    }

    setError('')
    setBusy(true)
    try {
      if (registering) await signUp(email.trim(), password, name)
      else await signIn(email.trim(), password)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="app login">
      <div className="login-inner">
        <h1>בית ותקציב</h1>
        <p className="muted">שניכם, אותו חודש, אותה תמונה.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="cat-pills">
          <button
            type="button" className="cat-pill" data-category="fixed"
            aria-pressed={!registering} onClick={() => switchTo('signin')}
          >
            כניסה
          </button>
          <button
            type="button" className="cat-pill" data-category="income"
            aria-pressed={registering} onClick={() => switchTo('signup')}
          >
            הרשמה
          </button>
        </div>

        {registering && (
          <label className="field" htmlFor="name">
            השם שלך
            <input
              id="name" className="input" required maxLength={60}
              placeholder="איך לקרוא לך"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}

        <label className="field" htmlFor="email">
          אימייל
          <input
            id="email" className="input ltr" type="email" required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field" htmlFor="password">
          סיסמה
          <input
            id="password" className="input ltr" type="password" required
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? MIN_PASSWORD : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {registering && <span className="type-hint">לפחות {MIN_PASSWORD} תווים.</span>}
        </label>

        {error && <p className="notice" role="alert">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'רגע...' : registering ? 'יצירת חשבון' : 'כניסה'}
        </button>

        <button type="button" className="btn-secondary" onClick={handleGoogle} disabled={busy}>
          המשך עם Google
        </button>

        <p className="hint center">
          {registering
            ? 'יש לכם קוד הזמנה? אחרי ההרשמה תוכלו להצטרף איתו לתקציב קיים.'
            : 'אין לכם עדיין חשבון? עברו להרשמה.'}
        </p>
      </form>
    </main>
  )
}

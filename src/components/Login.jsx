import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
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
      <div className="login-blob one" />
      <div className="login-blob two" />

      <div className="login-inner">
        <div className="login-mark">ב</div>
        <h1>בית ותקציב</h1>
        <p className="muted">שניכם, אותו חודש, אותה תמונה.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="email">
          אימייל
          <input
            id="email"
            className="input ltr"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field" htmlFor="password">
          סיסמה
          <input
            id="password"
            className="input ltr"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="notice" role="alert">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'מתחבר...' : 'כניסה'}
        </button>

        <button type="button" className="btn-secondary" onClick={handleGoogle} disabled={busy}>
          כניסה עם Google
        </button>

        <p className="hint center">הצטרפות לתקציב קיים? יש לכם קוד הזמנה.</p>
      </form>
    </main>
  )
}

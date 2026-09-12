import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="app login">
      <h1>BudgetTracker</h1>
      <p className="subtitle">מעקב הכנסות והוצאות משפחתי</p>

      <form className="card" onSubmit={handleSubmit}>
        <h2>התחברות</h2>

        <label htmlFor="email">אימייל</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label htmlFor="password">סיסמה</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'מתחבר...' : 'כניסה'}
        </button>

        <div className="divider"><span>או</span></div>

        <button type="button" className="secondary" onClick={handleGoogle} disabled={submitting}>
          התחברות עם Google
        </button>
      </form>
    </main>
  )
}

import { Component } from 'react'

/**
 * מסך לבן הוא התסמין הכי חסר תועלת שיש: הוא לא אומר דבר למשתמש ולא
 * למי שמתחזק. כאן כל שגיאת רינדור נתפסת ומוצגת כטקסט, עם כפתור
 * שמנקה service workers ומטמונים, כי חלק מהתקלות שורדות רענון רגיל.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('שגיאת רינדור:', error, info?.componentStack)
  }

  async reset() {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? []
      await Promise.all(registrations.map((registration) => registration.unregister()))
      const keys = await caches?.keys?.() ?? []
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {
      // גם אם הניקוי נכשל, טעינה מחדש היא עדיין הצעד הנכון
    }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="app">
        <div className="app-scroll">
          <header className="screen-head">
            <div>
              <h1>משהו נשבר</h1>
              <p className="muted">הנה מה שקרה, כדי שאפשר יהיה לתקן.</p>
            </div>
          </header>

          <p className="notice block" role="alert">
            <strong>{error.name}: {error.message}</strong>
          </p>

          {error.stack && (
            <div className="table-scroll">
              <pre className="error-stack">{error.stack.split('\n').slice(0, 8).join('\n')}</pre>
            </div>
          )}

          <button type="button" className="btn-primary" onClick={() => this.reset()}>
            ניקוי וטעינה מחדש
          </button>
        </div>
      </main>
    )
  }
}

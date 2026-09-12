import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * גרסה חדשה לא מוחלפת מתחת לידיים תוך כדי הזנת נתונים 
 * המשתמש מחליט מתי לרענן.
 */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="toast" role="status">
      <span>{needRefresh ? 'יש גרסה חדשה של האפליקציה' : 'האפליקציה זמינה גם ללא חיבור'}</span>
      <div className="toast-actions">
        {needRefresh && (
          <button type="button" className="go" onClick={() => updateServiceWorker(true)}>
            רענון
          </button>
        )}
        <button
          type="button"
          className="dismiss"
          onClick={() => { setOfflineReady(false); setNeedRefresh(false) }}
        >
          סגור
        </button>
      </div>
    </div>
  )
}

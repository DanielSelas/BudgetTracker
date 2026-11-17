import { useRegisterSW } from 'virtual:pwa-register/react'

/** כל שעה, לאפליקציה שנשארת פתוחה ימים */
const CHECK_EVERY = 60 * 60 * 1000

/**
 * גרסה חדשה לא מוחלפת מתחת לידיים תוך כדי הזנת נתונים 
 * המשתמש מחליט מתי לרענן.
 *
 * אבל כדי שיהיה מה להחליט, צריך לבדוק. הבדיקה של הדפדפן רצה בטעינת
 * עמוד בלבד, ואפליקציה שהותקנה למסך הבית ב-iOS כמעט אף פעם לא נטענת
 * באמת: היא חוזרת מהזיכרון. לכן בודקים גם בכל חזרה אליה, וגם מדי
 * שעה. בלי זה גרסה חדשה יכולה לשבת על השרת ימים בלי שאיש יידע.
 */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible') registration.update()
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, CHECK_EVERY)
      check()
    },
  })

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

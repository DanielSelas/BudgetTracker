import { useEffect, useState } from 'react'

/** הרשומות ממשיכות להישמר מקומית, אבל חשוב שיהיה ברור שהשותף עדיין לא רואה אותן. */
export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <p className="float-strip" role="status">
      אין חיבור. השינויים נשמרים במכשיר ויסונכרנו כשהחיבור יחזור.
    </p>
  )
}

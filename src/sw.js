/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

/**
 * ה-service worker נכתב ידנית ולא נוצר אוטומטית, כי אנחנו צריכים גם את
 * המטמון של workbox וגם קבלת התראות ברקע. שני service workers על אותו
 * scope לא יכולים לחיות יחד: השני מחליף את הראשון ומבטל את האופליין.
 */

/**
 * השתלטות מיידית, בלי להמתין לאישור. עדכון שממתין לאישור המשתמש
 * יוצר מלכוד: אם הגרסה הפעילה שבורה, אין מסך שדרכו אפשר לאשר,
 * והמכשיר נתקע עליה עד התקנה מחדש.
 */
self.skipWaiting()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/**
 * מסלול הניווט. בגרסה שנוצרת אוטומטית הוא מתווסף לבד, וכשעברתי
 * ל-service worker כתוב ידנית הוא נשמט. בלעדיו כל פתיחה של האפליקציה
 * המותקנת לא מקבלת את index.html, והמסך נשאר לבן.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (firebaseConfig.projectId) {
  const messaging = getMessaging(initializeApp(firebaseConfig))

  onBackgroundMessage(messaging, (payload) => {
    const { title, body, link } = payload.data ?? {}
    if (!title) return
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: 'month-end-nudge',
      data: { link: link || '/' },
    })
  })
}

// לחיצה על ההתראה מתמקדת בלשונית פתוחה אם יש אחת, במקום לפתוח עוד אחת
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(link)
          return client.focus()
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})

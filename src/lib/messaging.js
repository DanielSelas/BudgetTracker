import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import app, { db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY
const TOKEN_STORAGE_KEY = 'budgettracker:pushToken'

/** באייפון ה-Notification API קיים רק כשהאפליקציה מותקנת למסך הבית. */
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * מחזיר את המצב שבו נמצא המכשיר, כדי שהממשק יסביר מה חסר במקום
 * להציג מתג שלא יעבוד.
 */
export async function notificationState() {
  if (!VAPID_KEY) return 'unconfigured'
  if (typeof Notification === 'undefined' || !(await isSupported())) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && readStoredToken() ? 'enabled' : 'off'
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // מצב פרטי בדפדפן. ההרשמה תעבוד, היא פשוט לא תיזכר בין ביקורים.
  }
}

export async function enableNotifications(uid) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'

  // נרשמים דרך ה-service worker הקיים ולא דרך ברירת המחדל של FCM,
  // אחרת נרשם service worker שני שידרוס את המטמון של האפליקציה.
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) return 'off'

  await setDoc(doc(db, 'users', uid, 'devices', token), {
    token,
    platform: navigator.platform || '',
    updatedAt: serverTimestamp(),
  })
  storeToken(token)
  return 'enabled'
}

export async function disableNotifications(uid) {
  const token = readStoredToken()
  storeToken(null)
  if (!token) return 'off'

  // מוחקים קודם את הרישום ב-Firestore: מוטב שהשולח לא יכיר מכשיר קיים
  // מאשר שיישאר רישום שמקבל התראות אחרי שהמשתמש כיבה אותן.
  await deleteDoc(doc(db, 'users', uid, 'devices', token)).catch(() => {})
  await deleteToken(getMessaging(app)).catch(() => {})
  return 'off'
}

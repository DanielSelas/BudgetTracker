import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * הפרופיל של המשתמש: מקור אמת אחד לשם ולצבע.
 *
 * קודם השם ישב בנפרד בכל תקציב, ב-members/{uid}.displayName, ולכן
 * שינוי שלו במקום אחד השאיר אותו ישן בכל השאר. הצבע היה גרוע יותר:
 * הוא נגזר מהמקום ברשימה, כך שאותו אדם היה בצבע אחד בתקציב אחד
 * ובאחר בשני, ויציאה של חבר הזיזה את הצבעים של כולם.
 *
 * עכשיו שניהם שייכים לאדם, וזהים בכל מקום ולתמיד.
 */

/** הגוונים שאפשר לבחור. שלושת הראשונים הם אלה שהיו בשימוש עד היום. */
export const TONES = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']

export const TONE_LABEL = {
  a1: 'חמרה',
  a2: 'זית',
  a3: 'פחם',
  a4: 'משמש',
  a5: 'מרווה',
  a6: 'חול',
}

/** גוון יציב לפי המזהה, כברירת מחדל למי שעוד לא בחר. */
export function defaultTone(uid) {
  let hash = 0
  for (let index = 0; index < String(uid).length; index += 1) {
    hash = (hash * 31 + String(uid).charCodeAt(index)) >>> 0
  }
  return TONES[hash % TONES.length]
}

export const profileRef = (uid) => doc(db, 'users', uid)

export function watchProfile(uid, onChange, onError) {
  return onSnapshot(
    profileRef(uid),
    (snapshot) => onChange(snapshot.exists() ? { uid, ...snapshot.data() } : null),
    onError,
  )
}

/**
 * שמירה חלקית: המסך עשוי לשנות רק את השם או רק את הצבע, ו-merge
 * מונע מחיקה בשוגג של השדה השני.
 */
export function saveProfile(uid, changes) {
  return setDoc(
    profileRef(uid),
    { ...changes, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

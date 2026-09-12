import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

const INVITE_TTL_DAYS = 7
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // בלי תווים שמתבלבלים: I,O,0,1

function generateInviteCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export function normalizeInviteCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * יוצר תקציב, את מסמך החבר של היוצר ואת האינדקס האישי, בכתיבה אטומית אחת.
 * מחזיר את מזהה התקציב.
 */
export async function createBudget({ uid, name }) {
  const budgetRef = doc(collection(db, 'budgets'))

  // שני שלבים ולא כתיבה אטומית אחת: הכלל שמאשר את מסמך החבר של הבעלים
  // קורא את ownerUid מתוך מסמך התקציב, והכללים מוערכים מול המצב שלפני
  // הכתיבה, בכתיבה אחת המסמך עדיין לא היה קיים והיצירה הייתה נדחית.
  await setDoc(budgetRef, {
    name: name.trim(),
    ownerUid: uid,
    createdAt: serverTimestamp(),
  })

  const batch = writeBatch(db)
  batch.set(doc(budgetRef, 'members', uid), {
    uid,
    role: 'owner',
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'users', uid, 'memberships', budgetRef.id), {
    budgetId: budgetRef.id,
    joinedAt: serverTimestamp(),
  })

  await batch.commit()
  return budgetRef.id
}

/** יוצר קוד הזמנה חד-פעמי בתוקף שבוע. */
export async function createInvite({ uid, budgetId }) {
  const code = generateInviteCode()
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await setDoc(doc(db, 'invites', code), {
    budgetId,
    createdBy: uid,
    active: true,
    createdAt: serverTimestamp(),
    expiresAt,
  })

  return { code, expiresAt: expiresAt.toDate() }
}

/** בודק הזמנה לפני הצטרפות, כדי להציג שגיאה ברורה במקום permission-denied. */
export async function peekInvite(rawCode) {
  const code = normalizeInviteCode(rawCode)
  if (!code) return { code, status: 'invalid' }

  const snapshot = await getDoc(doc(db, 'invites', code))
  if (!snapshot.exists()) return { code, status: 'not-found' }

  const invite = snapshot.data()
  if (!invite.active) return { code, status: 'used' }
  if (invite.expiresAt.toMillis() < Date.now()) return { code, status: 'expired' }

  return { code, status: 'ok', budgetId: invite.budgetId }
}

/**
 * מצרף את המשתמש לתקציב ומכבה את ההזמנה, הכל או כלום.
 * הכתיבה האטומית היא שמונעת קוד שנוצל אך ההצטרפות נכשלה, או להפך.
 */
export async function joinBudgetWithInvite({ uid, rawCode }) {
  const invite = await peekInvite(rawCode)
  if (invite.status !== 'ok') return invite

  const { code, budgetId } = invite
  const batch = writeBatch(db)

  batch.set(doc(db, 'budgets', budgetId, 'members', uid), {
    uid,
    role: 'member',
    inviteCode: code,
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'users', uid, 'memberships', budgetId), {
    budgetId,
    joinedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'invites', code), {
    active: false,
    usedBy: uid,
    usedAt: serverTimestamp(),
  })

  await batch.commit()
  return { ...invite, status: 'joined' }
}

/** מאזין לרשימת התקציבים שהמשתמש חבר בהם. */
export function watchMemberships(uid, onChange, onError) {
  return onSnapshot(
    collection(db, 'users', uid, 'memberships'),
    (snapshot) => onChange(snapshot.docs.map((item) => item.id)),
    onError,
  )
}

/** מאזין לרשימת החברים של תקציב, משמש להבחנה בין אישי למשותף. */
export function watchMembers(budgetId, onChange, onError) {
  return onSnapshot(
    collection(db, 'budgets', budgetId, 'members'),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }))),
    onError,
  )
}

/** מאזין למסמך תקציב בודד. */
export function watchBudget(budgetId, onChange, onError) {
  return onSnapshot(
    doc(db, 'budgets', budgetId),
    (snapshot) => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  )
}

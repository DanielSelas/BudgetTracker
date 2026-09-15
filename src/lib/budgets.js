import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_BILLING_DAY } from './model'
import { budgetId as readableBudgetId, entriesRef, entryRef } from './paths'

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
export async function createBudget({
  uid,
  email = '',
  name,
  displayName = '',
  type = 'household',
  frame = 0,
  linkedBudgetId = null,
  billingDay = DEFAULT_BILLING_DAY,
  baseAmount = 0,
}) {
  // מזהה קריא במקום מחרוזת אקראית, כדי שרשימת התקציבים בקונסולה
  // תהיה מובנת בלי להיכנס לכל מסמך
  const budgetRef = doc(db, 'budgets', readableBudgetId({ type, name }))

  // שני שלבים ולא כתיבה אטומית אחת: הכלל שמאשר את מסמך החבר של הבעלים
  // קורא את ownerUid מתוך מסמך התקציב, והכללים מוערכים מול המצב שלפני
  // הכתיבה, בכתיבה אחת המסמך עדיין לא היה קיים והיצירה הייתה נדחית.
  await setDoc(budgetRef, {
    name: name.trim(),
    ownerUid: uid,
    // עותק לקריאה אנושית בלבד. המערכת עובדת מול ownerUid, וזה כאן
    // כדי שבקונסולה יהיה ברור של מי התקציב בלי לחפש את המזהה
    ownerEmail: email,
    type,
    // מועד החיוב שייך למשק בית בלבד. לטיול ולמטרה אין כרטיס משלהם
    ...(type === 'household'
      ? {
          billingDay: Number(billingDay) || DEFAULT_BILLING_DAY,
          // אפס פירושו גזירה אוטומטית מההכנסה, כפי שהיה תמיד
          baseAmount: Math.max(0, Number(baseAmount) || 0),
        }
      : { frame: Number(frame) || 0, linkedBudgetId }),
    createdAt: serverTimestamp(),
  })

  const batch = writeBatch(db)
  batch.set(doc(budgetRef, 'members', uid), {
    uid,
    email,
    role: 'owner',
    displayName,
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
export async function joinBudgetWithInvite({ uid, email = '', rawCode, displayName = '' }) {
  const invite = await peekInvite(rawCode)
  if (invite.status !== 'ok') return invite

  const { code, budgetId } = invite
  const batch = writeBatch(db)

  batch.set(doc(db, 'budgets', budgetId, 'members', uid), {
    uid,
    email,
    role: 'member',
    displayName,
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

/**
 * מוחק תקציב על כל מה שתלוי בו: הרשומות, החיובים הקבועים, החברים
 * והמצביעים האישיים. הכל בכתיבה אטומית אחת, אחרת סגירה באמצע הייתה
 * משאירה רשומות יתומות שאף אחד כבר לא יכול לראות או למחוק.
 */
export async function deleteBudget({ budgetId, ownerUid, memberUids }) {
  const [entries, templates] = await Promise.all([
    getDocs(entriesRef(budgetId)),
    getDocs(collection(db, 'budgets', budgetId, 'recurring')),
  ])

  const batch = writeBatch(db)
  for (const entry of entries.docs) batch.delete(entry.ref)
  for (const template of templates.docs) batch.delete(template.ref)

  for (const uid of memberUids) {
    batch.delete(doc(db, 'users', uid, 'memberships', budgetId))
    if (uid !== ownerUid) batch.delete(doc(db, 'budgets', budgetId, 'members', uid))
  }
  // הבעלים נמחק אחרון: כלל המחיקה של חבר בודק מי הבעלים
  batch.delete(doc(db, 'budgets', budgetId, 'members', ownerUid))
  batch.delete(doc(db, 'budgets', budgetId))

  await batch.commit()
}

/** מעדכן את השם והמייל שלך במסמך החבר. מותר רק על עצמך, לפי הכללים. */
export function setMemberName({ budgetId, uid, displayName, email }) {
  return updateDoc(doc(db, 'budgets', budgetId, 'members', uid), {
    displayName,
    ...(email ? { email } : {}),
  })
}

/**
 * משלים את המייל של הבעלים בתקציבים שנוצרו לפני שהשדה היה קיים.
 * רק הבעלים יכול, וגם הוא רק במייל שלו, לפי הכללים.
 */
export function healOwnerEmail({ budgetId, email }) {
  return updateDoc(doc(db, 'budgets', budgetId), { ownerEmail: email })
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

/**
 * מקשר תקציב מסגרת לתקציב בית, או מנתק אותו.
 * השורות המסכמות שכבר נכתבו בבית הקודם נמחקות כאן, אחרת היו נשארות
 * שם בלי מקור שמעדכן אותן. השורות בבית החדש ייכתבו מעצמן בסנכרון הבא.
 */
export async function setFrameLink({ budgetId, previousLinkedId, months = [], linkedBudgetId }) {
  if (previousLinkedId && previousLinkedId !== linkedBudgetId && months.length > 0) {
    const batch = writeBatch(db)
    // השורות המסכמות יושבות בתקציב שאליו הן נזקפו, ולא בתקציב המסגרת
    for (const month of months) {
      batch.delete(entryRef(previousLinkedId, `trip_${budgetId}__${month}`))
    }
    await batch.commit()
  }
  await updateDoc(doc(db, 'budgets', budgetId), { linkedBudgetId: linkedBudgetId || null })
}

/**
 * שינוי שם התקציב. הכללים כבר מתירים לכל חבר לעדכן את המסמך כל עוד
 * הבעלים והסוג לא משתנים, ולכן אין כאן יותר מזה.
 */
export function renameBudget({ budgetId, name }) {
  return updateDoc(doc(db, 'budgets', budgetId), { name: name.trim().slice(0, 60) })
}

/** שינוי מועד החיוב. אנשים מחליפים תאריך מול חברת האשראי, ואז גם כאן. */
export function setBillingDay({ budgetId, billingDay }) {
  return updateDoc(doc(db, 'budgets', budgetId), { billingDay: Number(billingDay) })
}

/** סכום הבסיס שהמשתמש מתכנן. אפס מחזיר לגזירה אוטומטית מההכנסה. */
export function setBaseAmount({ budgetId, baseAmount }) {
  return updateDoc(doc(db, 'budgets', budgetId), {
    baseAmount: Math.max(0, Number(baseAmount) || 0),
  })
}

import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * קישור תקציב מסגרת לתקציב בית: הוא מחזיק את כל הפירוט, והבית מקבל
 * שורה מסכמת אחת לכל חודש. לא מעתיקים שורות פעמיים, כדי שלא ייווצרו
 * שני מספרים לאותו כסף.
 *
 * טיול נכנס לשארית, כי הוא הוצאה חד פעמית שמחוץ לתוכנית. מטרת חיסכון
 * נכנסת לקרן, כי היא בדיוק מה שיעד ה-20% מיועד לו.
 */
const ROLLUP_TARGET = {
  trip: { category: 'unplanned', budgetGroup: 'none', prefix: 'טיול' },
  goal: { category: 'fund', budgetGroup: 'savings', prefix: 'חיסכון' },
}

const targetFor = (trip) => ROLLUP_TARGET[trip?.type] ?? ROLLUP_TARGET.trip

export const rollupEntryId = (tripId, month) => `trip_${tripId}__${month}`

/** סכום ההוצאה בטיול לכל חודש, לפי התאריך של כל רשומה. */
export function totalsByMonth(entries, signOf = () => 1) {
  const totals = new Map()
  for (const entry of entries) {
    const month = entry.month
    if (!month) continue
    totals.set(month, (totals.get(month) || 0) + (entry.actualAmount || 0) * signOf(entry))
  }
  return totals
}

/** משיכה מקטינה את מה שהועבר לקרן באותו חודש. */
export const goalSign = (entry) => (entry.category === 'withdrawal' ? -1 : 1)

export const rollupName = (trip) => `${targetFor(trip).prefix}: ${trip.name}`

function rollupPayload({ trip, month, amount, uid }) {
  const target = targetFor(trip)
  return {
    budgetId: trip.linkedBudgetId,
    month,
    category: target.category,
    budgetGroup: target.budgetGroup,
    name: rollupName(trip),
    plannedAmount: 0,
    actualAmount: amount,
    note: '',
    addedBy: uid,
    linkedTripId: trip.id,
  }
}

/**
 * מיישר את השורות המסכמות במשק הבית מול מצב הטיול.
 * יצירה ועדכון הן פעולות נפרדות בכוונה: כלל העדכון דורש ש-addedBy
 * יישאר כפי שהיה, ולכן אסור לשלוח אותו שוב על שורה קיימת.
 */
export async function syncRollup({ trip, entries, uid, knownMonths = [] }) {
  if (!trip?.linkedBudgetId) return { synced: 0 }

  const totals = totalsByMonth(entries, trip.type === 'goal' ? goalSign : undefined)
  const months = new Set([...totals.keys(), ...knownMonths])
  let synced = 0

  for (const month of months) {
    const ref = doc(db, 'entries', rollupEntryId(trip.id, month))
    const amount = totals.get(month) || 0
    const existing = await getDoc(ref)

    if (amount <= 0) {
      if (existing.exists()) await deleteDoc(ref)
      continue
    }

    if (!existing.exists()) {
      await setDoc(ref, { ...rollupPayload({ trip, month, amount, uid }), createdAt: serverTimestamp() })
    } else if (existing.data().actualAmount !== amount || existing.data().name !== rollupName(trip)) {
      await updateDoc(ref, { actualAmount: amount, name: rollupName(trip) })
    } else {
      continue
    }
    synced += 1
  }

  return { synced }
}

/** מוחק טיול על כל רשומותיו, החברים בו, והשורות המסכמות שהוא יצר. */
export async function deleteTrip({ trip, memberUids }) {
  const entries = await getDocs(
    query(collection(db, 'entries'), where('budgetId', '==', trip.id)),
  )

  const months = new Set(entries.docs.map((item) => item.data().month).filter(Boolean))
  const batch = writeBatch(db)

  for (const entry of entries.docs) batch.delete(entry.ref)

  // השורות המסכמות חיות בתקציב אחר, ולכן הן לא נמחקות עם הטיול מעצמו
  if (trip.linkedBudgetId) {
    for (const month of months) {
      batch.delete(doc(db, 'entries', rollupEntryId(trip.id, month)))
    }
  }

  for (const uid of memberUids) {
    batch.delete(doc(db, 'users', uid, 'memberships', trip.id))
    if (uid !== trip.ownerUid) batch.delete(doc(db, 'budgets', trip.id, 'members', uid))
  }
  batch.delete(doc(db, 'budgets', trip.id, 'members', trip.ownerUid))
  batch.delete(doc(db, 'budgets', trip.id))

  await batch.commit()
}

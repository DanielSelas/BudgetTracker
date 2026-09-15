import { beforeEach, describe, expect, it, vi } from 'vitest'

// חנות בזיכרון במקום Firestore: הבדיקה כאן היא על מה נכתב, לא על איך
const store = new Map()

vi.mock('firebase/firestore', () => ({
  // הנתיב המלא הוא המפתח, כדי שהבדיקה תוכיח גם לאיזה תקציב נכתב
  collection: (_db, ...path) => ({ path: path.join('/') }),
  doc: (_db, ...path) => ({ path: path.join('/') }),
  getDoc: async (ref) => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) }),
  setDoc: async (ref, data) => void store.set(ref.path, data),
  updateDoc: async (ref, data) => void store.set(ref.path, { ...store.get(ref.path), ...data }),
  deleteDoc: async (ref) => void store.delete(ref.path),
  getDocs: async () => ({ docs: [] }),
  query: (...parts) => parts,
  where: (...parts) => parts,
  writeBatch: () => ({}),
  serverTimestamp: () => 'ts',
}))
vi.mock('../src/lib/firebase', () => ({ db: {} }))

const { syncRollup } = await import('../src/lib/trips')

const goal = { id: 'g1', type: 'goal', name: 'רכב חדש', linkedBudgetId: 'home' }
const trip = { id: 't1', type: 'trip', name: 'יוון', linkedBudgetId: 'home' }
const deposit = (month, actualAmount) => ({ category: 'deposit', month, actualAmount })
const withdrawal = (month, actualAmount) => ({ category: 'withdrawal', month, actualAmount })

describe('שורה מסכמת של מטרת חיסכון', () => {
  beforeEach(() => store.clear())

  it('נכנסת לקרן ולא לשארית', async () => {
    await syncRollup({ trip: goal, entries: [deposit('2026-09', 2000)], uid: 'u1' })
    // הנתיב עצמו הוא ההוכחה שהשורה נחתה בתקציב הבית ולא במטרה
    const row = store.get('budgets/home/entries/trip_g1__2026-09')
    expect(row.category).toBe('fund')
    expect(row.budgetGroup).toBe('savings')
    expect(row.budgetId).toBeUndefined()
    expect(row.name).toBe('חיסכון: רכב חדש')
    expect(row.actualAmount).toBe(2000)
  })

  it('משיכה מקזזת את הסכום שנזקף לבית', async () => {
    await syncRollup({
      trip: goal,
      entries: [deposit('2026-09', 2000), withdrawal('2026-09', 500)],
      uid: 'u1',
    })
    expect(store.get('budgets/home/entries/trip_g1__2026-09').actualAmount).toBe(1500)
  })

  it('משיכה שמאפסת את החודש מוחקת את השורה מהבית', async () => {
    await syncRollup({ trip: goal, entries: [deposit('2026-09', 800)], uid: 'u1' })
    await syncRollup({
      trip: goal,
      entries: [deposit('2026-09', 800), withdrawal('2026-09', 800)],
      uid: 'u1',
      knownMonths: ['2026-09'],
    })
    expect(store.has('budgets/home/entries/trip_g1__2026-09')).toBe(false)
  })

  it('טיול ממשיך להיזקף לשארית', async () => {
    await syncRollup({ trip, entries: [{ month: '2026-09', actualAmount: 4650 }], uid: 'u1' })
    const row = store.get('budgets/home/entries/trip_t1__2026-09')
    expect(row.category).toBe('unplanned')
    expect(row.budgetGroup).toBe('none')
    expect(row.name).toBe('טיול: יוון')
  })

  it('בלי קישור לא נכתבת שום שורה', async () => {
    const result = await syncRollup({
      trip: { ...goal, linkedBudgetId: null },
      entries: [deposit('2026-09', 2000)],
      uid: 'u1',
    })
    expect(result.synced).toBe(0)
    expect(store.size).toBe(0)
  })
})

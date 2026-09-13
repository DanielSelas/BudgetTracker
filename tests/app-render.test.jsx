import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

/**
 * מרנדר את כל עץ האפליקציה עם משתמש מחובר, כדי לתפוס קריסה שמתרחשת
 * רק אחרי התחברות. בדיקות הלוגיקה לא נוגעות בעץ הזה בכלל.
 */

const USER = { uid: 'u1', email: 'daniel@mail.com', displayName: 'דניאל' }
const emptySnapshot = { docs: [], empty: true }

vi.mock('../src/lib/firebase', () => ({
  db: {}, auth: {}, default: {},
  isFirebaseConfigured: true, missingFirebaseKeys: [],
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, next) => { next(USER); return () => {} }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  GoogleAuthProvider: class {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, next) => { next?.(emptySnapshot); return () => {} }),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => emptySnapshot),
  setDoc: vi.fn(async () => {}),
  addDoc: vi.fn(async () => ({ id: 'new' })),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => null),
  arrayUnion: vi.fn(() => null),
  writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) })),
  Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) }) },
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}))

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(), getToken: vi.fn(), deleteToken: vi.fn(),
  isSupported: vi.fn(async () => false),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

afterEach(cleanup)

describe('עץ האפליקציה עם משתמש מחובר', () => {
  it('נטען בלי לזרוק, ומגיע למסך תקציבים', async () => {
    const { default: App } = await import('../src/App')
    const { container } = render(<App />)
    await waitFor(() => {
      expect(container.textContent.length).toBeGreaterThan(0)
    })
    expect(container.textContent).not.toBe('')
  })
})

describe('גבול שגיאה', () => {
  it('מציג את השגיאה במקום מסך לבן', async () => {
    const { default: ErrorBoundary } = await import('../src/components/ErrorBoundary')
    function Broken() { throw new Error('נפילה לדוגמה') }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<ErrorBoundary><Broken /></ErrorBoundary>)
    spy.mockRestore()
    expect(container.textContent).toContain('משהו נשבר')
    expect(container.textContent).toContain('נפילה לדוגמה')
  })

  it('מרנדר רגיל כשאין שגיאה', async () => {
    const { default: ErrorBoundary } = await import('../src/components/ErrorBoundary')
    const { container } = render(<ErrorBoundary><p>תקין</p></ErrorBoundary>)
    expect(container.textContent).toBe('תקין')
  })
})

describe('כתיבות ל-Firestore', () => {
  /**
   * הפונקציה הזו השתמשה ב-updateDoc בלי לייבא אותו, ונפלה רק אחרי
   * התחברות. בדיקה שקוראת לכל כתיבה בפועל תופסת ייבוא חסר מיד.
   */
  it('כל פעולת כתיבה רצה בלי משתנה חסר', async () => {
    const budgets = await import('../src/lib/budgets')
    const uid = 'u1'

    await expect(budgets.setMemberName({ budgetId: 'b1', uid, displayName: 'דניאל' }))
      .resolves.not.toThrow()
    await expect(budgets.createBudget({ uid, name: 'בית', displayName: 'דניאל' }))
      .resolves.not.toThrow()
    await expect(budgets.createInvite({ uid, budgetId: 'b1' }))
      .resolves.not.toThrow()

    const recurring = await import('../src/lib/recurring')
    await expect(recurring.createTemplate({
      budgetId: 'b1', uid, month: '2026-09', category: 'fixed', name: 'שכר דירה',
      plannedAmount: 0, actualAmount: 100,
    })).resolves.not.toThrow()
    await expect(recurring.skipMonth('b1', 'r1', '2026-09')).resolves.not.toThrow()
    await expect(recurring.stopTemplate('b1', 'r1')).resolves.not.toThrow()

    const { entryActions } = await import('../src/hooks/useEntries')
    const actions = entryActions({ budgetId: 'b1', month: '2026-09', uid })
    await expect(actions.add({ category: 'fixed', name: 'x', actualAmount: 1 }))
      .resolves.not.toThrow()
    await expect(actions.update('e1', { actualAmount: 2 })).resolves.not.toThrow()
    await expect(actions.remove('e1')).resolves.not.toThrow()
  })
})

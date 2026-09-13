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

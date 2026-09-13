import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

/**
 * בדיקות רינדור. הבדיקות האחרות מכסות לוגיקה וכללי אבטחה, ולכן משתנה
 * לא מוגדר בתוך JSX עבר אותן בשקט והפיל את האפליקציה למסך לבן.
 * כאן רק שאלה אחת נשאלת על כל רכיב: הוא מצליח להיטען בלי לזרוק.
 */

vi.mock('../src/lib/firebase', () => ({
  db: {}, auth: {}, default: {},
  isFirebaseConfigured: true, missingFirebaseKeys: [],
}))
// onSnapshot מחזיר מיד תמונה ריקה, כדי שהרכיבים יעברו ממצב טעינה לתוכן
const emptySnapshot = { docs: [], empty: true }
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, onNext) => { onNext?.(emptySnapshot); return () => {} }),
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

afterEach(cleanup)

const me = { uid: 'u1', displayName: 'דניאל', role: 'owner' }
const partner = { uid: 'u2', displayName: 'נועה', role: 'member' }

const authValue = {
  user: { uid: 'u1', email: 'daniel@mail.com', displayName: 'דניאל' },
  loading: false,
  signIn: vi.fn(), signUp: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(),
}

const household = {
  id: 'b1', name: 'משק הבית', ownerUid: 'u1', type: 'household', members: [me, partner],
}
const trip = {
  id: 't1', name: 'יוון', ownerUid: 'u1', type: 'trip', frame: 12000, members: [me],
}
const goal = {
  id: 'g1', name: 'רכב חדש', ownerUid: 'u1', type: 'goal', frame: 40000,
  linkedBudgetId: 'b1', members: [me, partner],
}

function budgetValue(overrides = {}) {
  return {
    budgets: [household, trip],
    budgetIds: ['b1', 't1'],
    loading: false,
    hasNoBudgets: false,
    budgetId: 'b1',
    budget: household,
    selectBudget: vi.fn(),
    goHome: vi.fn(),
    error: null,
    ...overrides,
  }
}

async function renderWithContexts(node, budgetOverrides) {
  const { AuthContext } = await import('../src/context/AuthContext')
  const { BudgetContext } = await import('../src/context/BudgetContext')
  return render(
    <AuthContext.Provider value={authValue}>
      <BudgetContext.Provider value={budgetValue(budgetOverrides)}>
        {node}
      </BudgetContext.Provider>
    </AuthContext.Provider>,
  )
}

describe('רינדור ראשוני', () => {
  it('דף התקציבים נטען', async () => {
    const { default: BudgetHome } = await import('../src/components/BudgetHome')
    const { container } = await renderWithContexts(<BudgetHome />)
    expect(container.textContent).toContain('התקציבים שלי')
    expect(container.textContent).toContain('משק הבית')
  })

  it('מסך החודש נטען', async () => {
    const { default: MonthView } = await import('../src/components/MonthView')
    const { container } = await renderWithContexts(
      <MonthView budgetId="b1" budget={household} uid="u1" />,
    )
    expect(container.textContent).toContain('בלתם')
  })

  it('מסך הטיול נטען', async () => {
    const { default: TripView } = await import('../src/components/TripView')
    const { container } = await renderWithContexts(
      <TripView budgetId="t1" budget={trip} uid="u1" />,
    )
    expect(container.textContent).toContain('לינה')
  })

  it('מסך המטרה נטען', async () => {
    const { default: GoalView } = await import('../src/components/GoalView')
    const { container } = await renderWithContexts(
      <GoalView budgetId="g1" budget={goal} uid="u1" />,
    )
    expect(container.textContent).toContain('הפקדה')
    expect(container.textContent).toContain('משיכה')
    expect(container.textContent).toContain('נחסך עד היום')
  })

  it('מגירת ההוספה נטענת במצב מטרה', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const { summarizeGoal } = await import('../src/lib/model')
    const { container } = await renderWithContexts(
      <EntrySheet
        mode="goal"
        initialCategory="deposit"
        summary={summarizeGoal([], 40000)}
        me={{ member: me, index: 0 }}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.textContent).toContain('הפקדה חדשה')
    expect(container.textContent).toContain('כמה הפקדתם?')
  })

  it('מסך יצירת תקציב מציע שלושה סוגים', async () => {
    const { default: BudgetSetup } = await import('../src/components/BudgetSetup')
    const { container } = await renderWithContexts(<BudgetSetup onDone={vi.fn()} />)
    expect(container.textContent).toContain('משק בית')
    expect(container.textContent).toContain('מטרת חיסכון')
  })

  it('מגירת ההוספה נטענת במצב חודשי', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const { summarizeMonth } = await import('../src/lib/model')
    const { container } = await renderWithContexts(
      <EntrySheet
        initialCategory="fixed"
        summary={summarizeMonth([])}
        me={{ member: me, index: 0 }}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.textContent).toContain('הוצאה חדשה')
  })

  it('מגירת ההוספה נטענת במצב טיול', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const { summarizeTrip } = await import('../src/lib/model')
    const { container } = await renderWithContexts(
      <EntrySheet
        mode="trip"
        initialCategory="lodging"
        summary={summarizeTrip([], 12000)}
        me={{ member: me, index: 0 }}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.textContent).toContain('לינה')
  })

  it('מסך ההתחברות נטען', async () => {
    const { default: Login } = await import('../src/components/Login')
    const { container } = await renderWithContexts(<Login />)
    expect(container.textContent).toContain('הרשמה')
  })
})

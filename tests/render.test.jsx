import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

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

describe('קיבוץ שורות במסך החודש', () => {
  const groceries = (id, name, actualAmount) => ({
    id, name, actualAmount, category: 'fixed', budgetGroup: 'fixed',
    plannedAmount: 0, addedBy: 'u1', month: '2026-09', groupKey: 'קניות בסופר',
  })

  it('כרטיס הקטגוריה מציג שורה אחת מכווצת, ופותח את הפירוט בלחיצה', async () => {
    const { default: CategoryCard } = await import('../src/components/CategoryCard')
    const entries = [
      groceries('a', 'קנייה גדולה', 1240),
      groceries('b', 'חלב ולחם', 38),
      { id: 'c', name: 'שכר דירה', actualAmount: 5200, category: 'fixed',
        budgetGroup: 'fixed', plannedAmount: 5200, addedBy: 'u1', month: '2026-09' },
    ]
    const { container, getByText, queryByText } = await renderWithContexts(
      <CategoryCard
        category="fixed"
        entries={entries}
        group={{ target: 10000, actual: 6478, remaining: 3522 }}
        actions={{ update: vi.fn(), remove: vi.fn() }}
        onAdd={vi.fn()}
      />,
    )

    expect(getByText('2 קניות')).toBeTruthy()
    expect(getByText('שכר דירה')).toBeTruthy()
    // הפירוט סגור עד שנפתח, אחרת אין טעם בקיבוץ
    expect(queryByText('חלב ולחם')).toBeNull()

    fireEvent.click(container.querySelector('.group-head'))
    expect(getByText('חלב ולחם')).toBeTruthy()
    expect(getByText('קנייה גדולה')).toBeTruthy()
  })

  it('מגירת ההזנה שולחת את שם הקבוצה', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const onSubmit = vi.fn(async () => {})
    const { container, getByText } = await renderWithContexts(
      <EntrySheet
        initialCategory="fixed"
        groups={['קניות בסופר']}
        summary={{ baseAmount: 20000, groups: { fixed: { actual: 0 } } }}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(getByText('קניות בסופר'))
    fireEvent.change(container.querySelector('.amount-input'), { target: { value: '38' } })
    fireEvent.submit(container.querySelector('.sheet-form'))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ groupKey: 'קניות בסופר', actualAmount: 38 }),
    )
  })

  it('בלי בחירת קבוצה נשלח שדה ריק ולא נכתב כלום', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const onSubmit = vi.fn(async () => {})
    const { container } = await renderWithContexts(
      <EntrySheet
        initialCategory="fixed"
        summary={{ baseAmount: 20000, groups: { fixed: { actual: 0 } } }}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(container.querySelector('.amount-input'), { target: { value: '100' } })
    fireEvent.submit(container.querySelector('.sheet-form'))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ groupKey: '' }))
  })
})

describe('הסבר לכניסה ראשונה', () => {
  it('עובר בין השלבים ומסתיים בסימון שנראה', async () => {
    localStorage.removeItem('budgettracker:seen-intro')
    const { default: Welcome, seenIntro } = await import('../src/components/Welcome')
    const onClose = vi.fn()
    const { getByText, queryByText } = await renderWithContexts(<Welcome onClose={onClose} />)

    expect(getByText('תמונה אחת, לשניכם')).toBeTruthy()
    // הדוגמה חייבת להישאר עקבית לאורך השלבים, אחרת ההסבר לא מתחבר
    fireEvent.click(getByText('הבא'))
    expect(getByText('הכל מתחיל מהכנסה')).toBeTruthy()
    fireEvent.click(getByText('הבא'))
    expect(getByText('קבועות')).toBeTruthy()
    expect(getByText('פנאי')).toBeTruthy()
    expect(getByText('קרן')).toBeTruthy()
    fireEvent.click(getByText('הבא'))

    // בשלב האחרון אין דילוג, יש סיום
    expect(queryByText('דילוג')).toBeNull()
    fireEvent.click(getByText('מתחילים'))
    expect(onClose).toHaveBeenCalled()
    expect(seenIntro()).toBe(true)
  })

  it('דילוג מסמן שנראה, כדי שלא יחזור בכל כניסה', async () => {
    localStorage.removeItem('budgettracker:seen-intro')
    const { default: Welcome, seenIntro } = await import('../src/components/Welcome')
    const onClose = vi.fn()
    const { getByText } = await renderWithContexts(<Welcome onClose={onClose} />)

    fireEvent.click(getByText('דילוג'))
    expect(onClose).toHaveBeenCalled()
    expect(seenIntro()).toBe(true)
  })
})

describe('עריכת שורה במקום', () => {
  const row = (extra = {}) => ({
    id: 'e1', name: 'קניות סופר', actualAmount: 300, category: 'fixed',
    budgetGroup: 'fixed', plannedAmount: 0, addedBy: 'u1', month: '2026-09', ...extra,
  })

  async function openEditor(entry, onUpdate = vi.fn()) {
    const { default: CategoryCard } = await import('../src/components/CategoryCard')
    const view = await renderWithContexts(
      <CategoryCard
        category="fixed"
        entries={[entry]}
        group={{ target: 10000, actual: 300, remaining: 9700 }}
        actions={{ update: onUpdate, remove: vi.fn() }}
        onAdd={vi.fn()}
      />,
    )
    fireEvent.click(view.getByText(entry.name))
    return view
  }

  it('לחיצה על השם פותחת עריכה עם שם, קטגוריה וסכום', async () => {
    const { container, getByText } = await openEditor(row())
    expect(container.querySelector('.row-edit')).toBeTruthy()
    expect(container.querySelector('.row-edit .input').value).toBe('קניות סופר')
    expect(getByText('פנאי')).toBeTruthy()
    expect(getByText('בלתם')).toBeTruthy()
  })

  it('שולח רק את מה שבאמת השתנה', async () => {
    const onUpdate = vi.fn(async () => {})
    const { container, getByText } = await openEditor(row(), onUpdate)

    fireEvent.change(container.querySelector('.row-edit .input'), { target: { value: 'קניות בסופר' } })
    fireEvent.click(getByText('פנאי'))
    fireEvent.submit(container.querySelector('.row-edit'))

    expect(onUpdate).toHaveBeenCalledWith('e1', {
      actualAmount: 300, name: 'קניות בסופר', category: 'leisure',
    })
  })

  it('שורה של חיוב קבוע מסבירה שהשינוי הוא לחודש הזה בלבד', async () => {
    const { container } = await openEditor(row({ recurringId: 'r1' }))
    expect(container.textContent).toContain('בחודש הבא השורה תיווצר שוב מהתבנית')
  })

  it('שורה מסכמת מקושרת אינה ניתנת לעריכה', async () => {
    const { container, getByText } = await renderWithContexts(
      (await import('../src/components/CategoryCard')).default({
        category: 'fund',
        entries: [row({ category: 'fund', budgetGroup: 'savings', name: 'חיסכון: רכב', linkedTripId: 'g1' })],
        group: { target: 4000, actual: 300, remaining: 3700 },
        actions: { update: vi.fn(), remove: vi.fn() },
        onAdd: vi.fn(),
      }),
    )
    fireEvent.click(getByText('חיסכון: רכב'))
    expect(container.querySelector('.row-edit')).toBeNull()
  })

  it('הכנסה לא מציעה החלפת קטגוריה', async () => {
    const { default: CategoryCard } = await import('../src/components/CategoryCard')
    const { container, getByText } = await renderWithContexts(
      <CategoryCard
        category="income"
        entries={[row({ category: 'income', budgetGroup: 'none', name: 'משכורת' })]}
        group={null}
        actions={{ update: vi.fn(), remove: vi.fn() }}
        onAdd={vi.fn()}
      />,
    )
    fireEvent.click(getByText('משכורת'))
    expect(container.querySelector('.row-edit')).toBeTruthy()
    expect(container.querySelector('.row-edit .cat-pills')).toBeNull()
  })
})

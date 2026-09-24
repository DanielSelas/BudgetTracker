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
// גם אוסף ריק וגם מסמך שאינו קיים: onSnapshot משמש לשניהם,
// והפרופיל הוא האזנה למסמך בודד
const emptySnapshot = { docs: [], empty: true, exists: () => false, data: () => ({}) }
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
    // הכותרת של הבלת״ם, שהיא הכרטיס האחרון במסך
    expect(container.textContent).toContain('בלת״ם')
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
    expect(getByText('הוצאות משתנות')).toBeTruthy()
    expect(getByText('הפקדות')).toBeTruthy()
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
    expect(getByText('משתנות')).toBeTruthy()
    expect(getByText('בלת״ם')).toBeTruthy()
  })

  it('שולח רק את מה שבאמת השתנה', async () => {
    const onUpdate = vi.fn(async () => {})
    const { container, getByText } = await openEditor(row(), onUpdate)

    fireEvent.change(container.querySelector('.row-edit .input'), { target: { value: 'קניות בסופר' } })
    fireEvent.click(getByText('משתנות'))
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

describe('הסבר לפי סוג תקציב', () => {
  const KEYS = [
    'budgettracker:seen-intro',
    'budgettracker:seen-intro-trip',
    'budgettracker:seen-intro-goal',
  ]
  const clear = () => KEYS.forEach((key) => localStorage.removeItem(key))

  it('לטיול יש הסבר משלו, עם הקטגוריות של טיול', async () => {
    clear()
    const { default: Welcome } = await import('../src/components/Welcome')
    const { getByText } = await renderWithContexts(<Welcome kind="trip" onClose={vi.fn()} />)
    expect(getByText('מסגרת אחת לכל הטיול')).toBeTruthy()
    fireEvent.click(getByText('הבא'))
    expect(getByText('לינה')).toBeTruthy()
    expect(getByText('התניידות')).toBeTruthy()
  })

  it('למטרה יש הסבר משלה, עם הפקדה ומשיכה', async () => {
    clear()
    const { default: Welcome } = await import('../src/components/Welcome')
    const { getByText } = await renderWithContexts(<Welcome kind="goal" onClose={vi.fn()} />)
    expect(getByText('יעד אחד, ואתם מטפסים אליו')).toBeTruthy()
    fireEvent.click(getByText('הבא'))
    expect(getByText('הפקדה')).toBeTruthy()
    expect(getByText('משיכה')).toBeTruthy()
  })

  it('כל סוג נספר בנפרד, כך שהסבר אחד לא מבטל את האחרים', async () => {
    clear()
    const { default: Welcome, seenIntro } = await import('../src/components/Welcome')
    const { getByText } = await renderWithContexts(<Welcome kind="trip" onClose={vi.fn()} />)
    fireEvent.click(getByText('דילוג'))

    expect(seenIntro('trip')).toBe(true)
    expect(seenIntro('household')).toBe(false)
    expect(seenIntro('goal')).toBe(false)
  })
})

describe('הזמנה שייכת לתקציב שממנו נפתחה', () => {
  it('הפאנל אומר במפורש לאיזה תקציב ההצטרפות', async () => {
    const { default: InvitePanel } = await import('../src/components/InvitePanel')
    const { container } = await renderWithContexts(
      <InvitePanel budgetId="t1" budgetName="יוון" heading="הזמנה לטיול" />,
    )
    expect(container.textContent).toContain('הזמנה לטיול')
    expect(container.textContent).toContain('הצטרפות ל"יוון" בלבד')
  })

  it('דף התקציבים כבר לא מזמין לתקציב שלא נבחר', async () => {
    const { default: BudgetHome } = await import('../src/components/BudgetHome')
    const { container } = await renderWithContexts(<BudgetHome />)
    expect(container.querySelector('.invite-panel')).toBeNull()
    expect(container.textContent).not.toContain('קוד הזמנה')
  })
})

describe('יציאה לרשימת התקציבים', () => {
  it('כפתור חזרה מעל בורר החודשים', async () => {
    const { default: MonthView } = await import('../src/components/MonthView')
    const onBack = vi.fn()
    const { getByText } = await renderWithContexts(
      <MonthView budgetId="b1" budget={household} uid="u1" onBack={onBack} />,
    )
    fireEvent.click(getByText('התקציבים שלי'))
    expect(onBack).toHaveBeenCalled()
  })

  it('קיים גם במסך הטיול ובמסך המטרה', async () => {
    const { default: TripView } = await import('../src/components/TripView')
    const { default: GoalView } = await import('../src/components/GoalView')

    const onTripBack = vi.fn()
    const trips = await renderWithContexts(
      <TripView budgetId="t1" budget={trip} uid="u1" onDeleted={onTripBack} />,
    )
    fireEvent.click(trips.getByText('התקציבים שלי'))
    expect(onTripBack).toHaveBeenCalled()
    cleanup()

    const onGoalBack = vi.fn()
    const goals = await renderWithContexts(
      <GoalView budgetId="g1" budget={goal} uid="u1" onDeleted={onGoalBack} />,
    )
    fireEvent.click(goals.getByText('התקציבים שלי'))
    expect(onGoalBack).toHaveBeenCalled()
  })
})

describe('פרופיל נוצר בכניסה הראשונה', () => {
  it('משתמש בלי פרופיל מקבל אחד עם השם מההזדהות', async () => {
    const firestore = await import('firebase/firestore')
    firestore.setDoc.mockClear()
    const { renderHook, waitFor } = await import('@testing-library/react')
    const { useOwnProfile } = await import('../src/hooks/useOwnProfile')

    renderHook(() => useOwnProfile({ uid: 'u9', displayName: 'דניאל סלע', email: 'd@mail.com' }))

    await waitFor(() => expect(firestore.setDoc).toHaveBeenCalled())
    const [, body] = firestore.setDoc.mock.calls[0]
    expect(body.displayName).toBe('דניאל סלע')
    expect(body.tone).toBeTruthy()
  })

  it('בלי משתמש לא נכתב כלום', async () => {
    const firestore = await import('firebase/firestore')
    firestore.setDoc.mockClear()
    const { renderHook } = await import('@testing-library/react')
    const { useOwnProfile } = await import('../src/hooks/useOwnProfile')

    renderHook(() => useOwnProfile(null))
    expect(firestore.setDoc).not.toHaveBeenCalled()
  })
})

describe('דרכי כניסה למסכי התקציב', () => {
  /**
   * כפתור שנבנה אבל לא חוּוט הוא בדיוק מה שקרה כאן: המסך היה מוכן
   * ולא הייתה ממנו דרך להיכנס. בדיקה אחת על כל כפתור מונעת את זה.
   */
  const ACTIONS = [
    'כמה פנוי לי',
    'חיובים קבועים',
    'הזמנת שותף',
    'סכום הבסיס',
    'מועד חיוב',
    'שינוי שם',
    'מחיקה',
  ]

  it('כל פעולות התקציב מופיעות לבעלים', async () => {
    const { default: MonthView } = await import('../src/components/MonthView')
    const { getByText } = await renderWithContexts(
      <MonthView budgetId="b1" budget={household} uid="u1" />,
    )
    for (const label of ACTIONS) expect(getByText(label)).toBeTruthy()
  })

  it('לחיצה על חיובים קבועים פותחת את המסך', async () => {
    const { default: MonthView } = await import('../src/components/MonthView')
    const { getByText, container } = await renderWithContexts(
      <MonthView budgetId="b1" budget={household} uid="u1" />,
    )
    fireEvent.click(getByText('חיובים קבועים'))
    expect(container.textContent).toContain('+ חיוב קבוע חדש')
  })

  it('שותף שאינו בעלים רואה שיתוף וחיובים, לא מחיקה', async () => {
    const { default: MonthView } = await import('../src/components/MonthView')
    const { getByText, queryByText } = await renderWithContexts(
      <MonthView budgetId="b1" budget={household} uid="u2" />,
    )
    expect(getByText('חיובים קבועים')).toBeTruthy()
    expect(getByText('הזמנת שותף')).toBeTruthy()
    expect(queryByText('מחיקה')).toBeNull()
  })
})

describe('מסך ניקוי הרשומות', () => {
  /**
   * הכפתור היה מושבת לנצח: מסמכי התקציב מגיעים אחרי רשימת החברויות,
   * ולכן מזהה שנשמר ב-state בטעינה הראשונה נתפס ריק. עם תקציב אחד
   * אין בורר, ולא הייתה שום דרך לתקן את זה מהמסך.
   */
  const budget = { id: 'household_x', name: 'משק בית' }

  it('הכפתור פעיל כשהתקציב הגיע, גם בלי בורר', async () => {
    const { default: Cleanup } = await import('../src/components/Cleanup')
    const { getByText } = render(<Cleanup budgets={[budget]} />)
    expect(getByText('מה יימחק').disabled).toBe(false)
  })

  it('ורואים על איזה תקציב זה עומד לפעול', async () => {
    const { default: Cleanup } = await import('../src/components/Cleanup')
    const { container } = render(<Cleanup budgets={[budget]} />)
    expect(container.textContent).toContain('משק בית')
  })

  it('כשהתקציבים עוד לא הגיעו הכפתור מושבת ונאמר שטוענים', async () => {
    const { default: Cleanup } = await import('../src/components/Cleanup')
    const { getByText, container } = render(<Cleanup budgets={[]} />)
    expect(getByText('מה יימחק').disabled).toBe(true)
    expect(container.textContent).toContain('טוען תקציבים')
  })

  it('תקציב שנבחר ואינו קיים יותר חוזר לראשון', async () => {
    const { default: Cleanup } = await import('../src/components/Cleanup')
    const other = { id: 'household_y', name: 'תקציב שני' }
    const { container, rerender } = render(<Cleanup budgets={[budget, other]} />)
    rerender(<Cleanup budgets={[other]} />)
    expect(container.textContent).toContain('תקציב שני')
  })
})

describe('מסך הייבוא', () => {
  it('בורר הקבצים מקבל כמה קבצים יחד', async () => {
    const { default: ImportSheet } = await import('../src/components/ImportSheet')
    const { container } = render(<ImportSheet onImport={() => {}} onClose={() => {}} />)
    const input = container.querySelector('input[type="file"]')
    expect(input.multiple).toBe(true)
  })
})

describe('כלל הקיבוץ בהזנה ידנית', () => {
  it('שם שמוכר על ידי כלל נכנס לקבוצה שלו בלי שבוחרים אותה', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const onSubmit = vi.fn(async () => {})
    const { getByPlaceholderText, getByText } = render(
      <EntrySheet
        category="fixed" month="2026-09" me="דניאל"
        onSubmit={onSubmit} onClose={() => {}}
      />,
    )
    fireEvent.change(getByPlaceholderText('על מה'), {
      target: { value: 'שופרסל שלי גבעתיים' },
    })
    fireEvent.change(getByPlaceholderText('₪0'), { target: { value: '200' } })
    fireEvent.click(getByText('שמירה'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onSubmit).toHaveBeenCalled()
    expect(onSubmit.mock.calls[0][0].groupKey).toBe('סופר')
  })

  it('בחירה ידנית של קבוצה גוברת על הכלל', async () => {
    const { default: EntrySheet } = await import('../src/components/EntrySheet')
    const onSubmit = vi.fn(async () => {})
    const { getByPlaceholderText, getByText } = render(
      <EntrySheet
        category="fixed" month="2026-09" me="דניאל" groups={['דלק']}
        onSubmit={onSubmit} onClose={() => {}}
      />,
    )
    fireEvent.change(getByPlaceholderText('על מה'), {
      target: { value: 'שופרסל שלי גבעתיים' },
    })
    fireEvent.change(getByPlaceholderText('₪0'), { target: { value: '200' } })
    fireEvent.click(getByText('דלק'))
    fireEvent.click(getByText('שמירה'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onSubmit.mock.calls[0][0].groupKey).toBe('דלק')
  })
})

describe('בחירת חודש', () => {
  /**
   * input type="month" אינו נתמך בספארי במחשב ובפיירפוקס, ושם הוא
   * נופל לשדה טקסט חופשי בלי בורר ובלי רמז מה להקליד. זה מה שמנע
   * שמירה של "עד מתי".
   */
  it('אין בשום מסך שדה תאריך שספארי לא תומך בו', async () => {
    for (const name of ['Commitments', 'Cleanup', 'EntrySheet']) {
      const source = await import(`../src/components/${name}.jsx?raw`)
      expect(source.default).not.toContain('type="month"')
    }
  })

  const openPicker = async (props = {}) => {
    const { default: MonthSelect } = await import('../src/components/MonthSelect')
    const view = render(<MonthSelect onChange={() => {}} {...props} />)
    fireEvent.click(view.container.querySelector('.month-trigger'))
    return view
  }

  it('נפתח על השנה של החודש שנבחר, ומראה לוח של שנים עשר חודשים', async () => {
    const { getByText, container } = await openPicker({ value: '2026-09' })
    expect(getByText('2026')).toBeTruthy()
    expect(container.querySelectorAll('.month-cell')).toHaveLength(12)
    expect(getByText('ספטמבר').getAttribute('aria-pressed')).toBe('true')
  })

  it('החצים מזיזים שנה, ולכן שנתיים אחורה הן שתי לחיצות', async () => {
    const { getByText, getByLabelText } = await openPicker({ value: '2026-09' })
    fireEvent.click(getByLabelText('שנה קודמת'))
    fireEvent.click(getByLabelText('שנה קודמת'))
    expect(getByText('2024')).toBeTruthy()
  })

  it('בחירה מחזירה מפתח חודש וסוגרת', async () => {
    const onChange = vi.fn()
    const { getByText, container } = await openPicker({ value: '2026-09', onChange })
    fireEvent.click(getByText('דצמבר'))
    expect(onChange).toHaveBeenCalledWith('2026-12')
    expect(container.querySelector('.month-pop')).toBeNull()
  })

  it('חודש לפני הגבול חסום', async () => {
    const { getByText } = await openPicker({ value: '2026-09', from: '2026-05' })
    expect(getByText('אפריל').disabled).toBe(true)
    expect(getByText('מאי').disabled).toBe(false)
  })

  it('אבל חודש ששמור כבר נשאר בר בחירה, כדי שהוא לא יימחק', async () => {
    // נפתח על 2024 כי זו השנה של הערך השמור, והוא מחוץ לטווח
    const { getByText } = await openPicker({ value: '2024-01', from: '2026-05' })
    expect(getByText('2024')).toBeTruthy()
    expect(getByText('ינואר').disabled).toBe(false)
    expect(getByText('פברואר').disabled).toBe(true)
  })

  it('אפשר לבחור בלי תאריך סיום', async () => {
    const onChange = vi.fn()
    const { getByText } = await openPicker({ value: '2026-09', allowEmpty: true, onChange })
    fireEvent.click(getByText('בלי תאריך סיום'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('Escape סוגר בלי לשנות', async () => {
    const onChange = vi.fn()
    const { container } = await openPicker({ value: '2026-09', onChange })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('.month-pop')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('בלי ערך מוצג הטקסט הריק על הכפתור', async () => {
    const { default: MonthSelect } = await import('../src/components/MonthSelect')
    const { container } = render(
      <MonthSelect value="" emptyLabel="בלי תאריך סיום" onChange={() => {}} />,
    )
    expect(container.querySelector('.month-trigger').textContent).toBe('בלי תאריך סיום')
  })
})

describe('הפסקת חיוב קבוע', () => {
  /**
   * ממסך החיובים הקבועים הגיעה התבנית, שהמזהה שלה הוא id, והקוד קרא
   * ל-recurringId שקיים רק על שורה. הקריאה נכשלה בשקט, ושום דבר לא
   * קרה כשלחצו על הפסקה.
   */
  it('עובד גם עם תבנית וגם עם שורה', async () => {
    const recurring = await import('../src/lib/recurring')
    const stop = vi.spyOn(recurring, 'stopTemplate').mockResolvedValue()
    const { default: StopRecurring } = await import('../src/components/StopRecurring')

    // מסך החיובים הקבועים מעביר תבנית, ושורת החודש מעבירה רשומה
    for (const [template, expected] of [
      [{ id: 'fixed-שכר-דירה', name: 'שכר דירה' }, 'fixed-שכר-דירה'],
      [{ recurringId: 'fixed-חשמל', name: 'חשמל' }, 'fixed-חשמל'],
    ]) {
      const { getByText } = render(
        <StopRecurring template={template} budgetId="b1" onDone={() => {}} />,
      )
      fireEvent.click(getByText('הפסקה, בלי למחוק היסטוריה'))
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(stop).toHaveBeenLastCalledWith('b1', expected)
      cleanup()
    }
    stop.mockRestore()
  })

  it('מציע גם מחיקה מלאה, ואומר כמה שורות היא נוגעת בהן', async () => {
    const { default: StopRecurring } = await import('../src/components/StopRecurring')
    const { container } = render(
      <StopRecurring template={{ id: 'x', name: 'שכר דירה' }} budgetId="b1" onDone={() => {}} />,
    )
    // בלי מספר השורות אי אפשר לדעת מה ההבדל בפועל בין שתי האפשרויות
    expect(container.querySelector('.btn-danger')).toBeTruthy()
    expect(container.textContent).toContain('בודק כמה שורות')
  })
})

describe('כרטיס הבלת״ם', () => {
  /**
   * חודש מיובא בלי הכנסה: היתרה היא אפס, ולכן "כמה נשאר" הוא מספר
   * שלילי. ההוצאה הגדולה של החודש הוצגה כמינוס בכרטיס שכתוב בו
   * שהוא עוד לא נפתח, והסכומים של החודש לא הסתדרו למי שהסתכל.
   */
  const summary = (unplanned) => ({
    usesFixedBase: false,
    unplanned: { reserve: 0, spent: 0, remaining: 0, deposited: 0, planned: 0, ...unplanned },
  })

  it('בלי יתרה מוצגת ההוצאה עצמה, ולא מינוס', async () => {
    const { default: UnplannedCard } = await import('../src/components/UnplannedCard')
    const { container } = render(
      <UnplannedCard
        summary={summary({ spent: 15216, remaining: -15216 })}
        entries={[]} actions={{}} onAdd={() => {}} onDeposit={() => {}}
      />,
    )
    const total = container.querySelector('.cat-total').textContent
    expect(total).toContain('15,216')
    expect(total).not.toContain('-')
  })

  it('ונאמר במפורש שאין יתרה שתכסה אותה', async () => {
    const { default: UnplannedCard } = await import('../src/components/UnplannedCard')
    const { container } = render(
      <UnplannedCard
        summary={summary({ spent: 15216, remaining: -15216 })}
        entries={[]} actions={{}} onAdd={() => {}} onDeposit={() => {}}
      />,
    )
    expect(container.textContent).toContain('אין רזרבה שתכסה')
  })

  it('כשיש יתרה חוזרים להציג כמה נשאר', async () => {
    const { default: UnplannedCard } = await import('../src/components/UnplannedCard')
    const { container } = render(
      <UnplannedCard
        summary={summary({ reserve: 5000, spent: 1000, remaining: 4000 })}
        entries={[]} actions={{}} onAdd={() => {}} onDeposit={() => {}}
      />,
    )
    expect(container.querySelector('.cat-total').textContent).toContain('4,000')
  })
})

describe('שורות הבלת״ם', () => {
  /**
   * הרשימה הייתה מותנית ביתרה, ולכן בחודש מיובא בלי הכנסה כל שורות
   * הבלת״ם נעלמו מהמסך. הכסף נספר בסכום החודשי ולא היה שום מקום
   * לראות אותו או לתקן את הסיווג שלו.
   */
  const entries = [
    { id: 'e1', name: 'וט המומחים', category: 'unplanned', actualAmount: 11178, month: '2025-08' },
    { id: 'e2', name: 'וט המומחים', category: 'unplanned', actualAmount: 4037, month: '2025-08' },
  ]
  const summary = {
    usesFixedBase: false,
    unplanned: { reserve: 0, spent: 15215, remaining: -15215, deposited: 0, planned: 0 },
  }

  it('מוצגות גם כשאין יתרה', async () => {
    const { default: UnplannedCard } = await import('../src/components/UnplannedCard')
    const { container } = render(
      <UnplannedCard
        summary={summary} entries={entries} actions={{}}
        onAdd={() => {}} onDeposit={() => {}}
      />,
    )
    expect(container.textContent).toContain('וט המומחים')
    expect(container.textContent).toContain('בלת״ם')
  })

  it('ובחודש ריק בלי יתרה הכרטיס לא מציג רשימה ריקה', async () => {
    const { default: UnplannedCard } = await import('../src/components/UnplannedCard')
    const { container } = render(
      <UnplannedCard
        summary={{ usesFixedBase: false, unplanned: { reserve: 0, spent: 0, remaining: 0, deposited: 0, planned: 0 } }}
        entries={[]} actions={{}} onAdd={() => {}} onDeposit={() => {}}
      />,
    )
    expect(container.querySelector('.subsection')).toBeNull()
  })
})

describe('סימון הוצאה חד פעמית', () => {
  /**
   * הכלבה עברה ניתוח באוגוסט 2025, והוא לבדו הפך את החודש הזה
   * ליקר ביותר מתוך תשעה עשר. בלי הסימון, התובנה הראשונה שהאפליקציה
   * הייתה מפיקה היא ש"באוגוסט מוציאים הרבה", והיא הייתה נלמדת
   * מאירוע אחד שלא יחזור.
   */
  const entry = {
    id: 'e1', name: 'וט המומחים', category: 'unplanned',
    actualAmount: 11178, month: '2025-08',
  }

  it('הסימון וההערה נשמרים יחד', async () => {
    const { default: EntryRow } = await import('../src/components/EntryRow')
    const onUpdate = vi.fn(async () => {})
    const { getByText, getByLabelText, getByPlaceholderText } = render(
      <ul><EntryRow entry={entry} onUpdate={onUpdate} onRemove={() => {}} /></ul>,
    )
    fireEvent.click(getByLabelText(`עריכה של ${entry.name}`))
    fireEvent.click(getByText('הוצאה חד פעמית'))
    fireEvent.change(getByPlaceholderText('למה? למשל: ניתוח לכלבה'), {
      target: { value: 'ניתוח לכלבה' },
    })
    fireEvent.click(getByText('שמור'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onUpdate).toHaveBeenCalledWith('e1', expect.objectContaining({
      oneOff: true, note: 'ניתוח לכלבה',
    }))
  })

  it('שורה מסומנת מציגה את זה, וההערה היא ההסבר', async () => {
    const { default: EntryRow } = await import('../src/components/EntryRow')
    const { getByText } = render(
      <ul>
        <EntryRow
          entry={{ ...entry, oneOff: true, note: 'ניתוח לכלבה' }}
          onUpdate={() => {}} onRemove={() => {}}
        />
      </ul>,
    )
    expect(getByText('· חד פעמי').title).toBe('ניתוח לכלבה')
  })

  it('ביטול הסימון נשלח במפורש, כדי שהשדה יימחק ולא יישאר', async () => {
    const { default: EntryRow } = await import('../src/components/EntryRow')
    const onUpdate = vi.fn(async () => {})
    const { getByText, getByLabelText } = render(
      <ul>
        <EntryRow
          entry={{ ...entry, oneOff: true, note: 'ניתוח לכלבה' }}
          onUpdate={onUpdate} onRemove={() => {}}
        />
      </ul>,
    )
    fireEvent.click(getByLabelText(`עריכה של ${entry.name}`))
    fireEvent.click(getByText('הוצאה חד פעמית'))
    fireEvent.click(getByText('שמור'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onUpdate.mock.calls[0][1].oneOff).toBe(false)
  })

  it('הוצאה שלא סומנה אינה שולחת את השדה בכלל', async () => {
    const { default: EntryRow } = await import('../src/components/EntryRow')
    const onUpdate = vi.fn(async () => {})
    const { getByText, getByLabelText } = render(
      <ul><EntryRow entry={entry} onUpdate={onUpdate} onRemove={() => {}} /></ul>,
    )
    fireEvent.click(getByLabelText(`עריכה של ${entry.name}`))
    fireEvent.click(getByText('שמור'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onUpdate.mock.calls[0][1]).not.toHaveProperty('oneOff')
  })
})

describe('מסך כמה פנוי לי', () => {
  const templates = [
    { id: 'salary', name: 'משכורת', active: true, category: 'income', actualAmount: 20000, startMonth: '2026-01' },
    { id: 'rent', name: 'שכר דירה', active: true, category: 'fixed', actualAmount: 5800, startMonth: '2026-01' },
    { id: 'loan', name: 'הלוואה', active: true, category: 'fixed', actualAmount: 1100, startMonth: '2026-01', endMonth: '2026-10' },
  ]
  const entries = [
    { id: 'a', month: '2026-07', category: 'leisure', actualAmount: 2400 },
    { id: 'b', month: '2026-08', category: 'leisure', actualAmount: 2400 },
  ]
  const open = async (props = {}) => {
    const { default: Capacity } = await import('../src/components/Capacity')
    return render(
      <Capacity
        entries={entries} templates={templates} month="2026-09"
        onClose={() => {}} {...props}
      />,
    )
  }

  it('מציג את הפירוק, ולא רק מספר אחד', async () => {
    const { container } = await open()
    const text = container.textContent
    expect(text).toContain('הכנסה קבועה')
    expect(text).toContain('חיובים קבועים')
    expect(text).toContain('חודש רגיל')
  })

  it('החודש שאחרי סיום ההלוואה מסומן', async () => {
    const { container } = await open()
    expect(container.textContent).toContain('נגמר: הלוואה')
  })

  it('בלי הכנסה אומר מה חסר במקום להציג אפס', async () => {
    const { container } = await open({ templates: [], entries: [] })
    expect(container.textContent).toContain('אין עדיין הכנסה')
  })

  it('סכום מקבל תשובה של מתי, ולא כן או לא', async () => {
    const { container, getByPlaceholderText } = await open()
    fireEvent.change(getByPlaceholderText('למשל 20000'), { target: { value: '20000' } })
    expect(container.textContent).toContain('הסכום מצטבר עד')
    expect(container.textContent).toContain('ההחלטה שלכם')
  })
})

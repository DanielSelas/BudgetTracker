import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'

const OWNER = 'owner-uid'
const PARTNER = 'partner-uid'
const STRANGER = 'stranger-uid'
const BUDGET = 'budget-1'

let testEnv

const future = () => Timestamp.fromMillis(Date.now() + 60 * 60 * 1000)
const past = () => Timestamp.fromMillis(Date.now() - 1000)

function entry(overrides = {}) {
  return {
    budgetId: BUDGET,
    category: 'fixed',
    budgetGroup: 'fixed',
    name: 'שכר דירה',
    plannedAmount: 5000,
    actualAmount: 5000,
    month: '2026-09',
    addedBy: OWNER,
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'budgettracker-rules-test',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => testEnv?.cleanup())

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'budgets', BUDGET), { name: 'משפחתי', ownerUid: OWNER })
    await setDoc(doc(db, 'budgets', BUDGET, 'members', OWNER), { uid: OWNER, role: 'owner' })
  })
})

const as = (uid) => testEnv.authenticatedContext(uid).firestore()
const anon = () => testEnv.unauthenticatedContext().firestore()

describe('budgets', () => {
  it('חבר קורא את התקציב, זר לא', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'budgets', BUDGET)))
    await assertFails(getDoc(doc(as(STRANGER), 'budgets', BUDGET)))
    await assertFails(getDoc(doc(anon(), 'budgets', BUDGET)))
  })

  it('יצירת תקציב רק עם ownerUid של עצמך', async () => {
    await assertSucceeds(
      setDoc(doc(as(PARTNER), 'budgets', 'b2'), { name: 'שלי', ownerUid: PARTNER }),
    )
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 'b3'), { name: 'גניבה', ownerUid: OWNER }),
    )
  })

  it('אי אפשר לחטוף בעלות על תקציב קיים', async () => {
    await assertFails(
      updateDoc(doc(as(OWNER), 'budgets', BUDGET), { ownerUid: STRANGER }),
    )
  })

  it('רק הבעלים מוחק תקציב', async () => {
    await assertFails(deleteDoc(doc(as(STRANGER), 'budgets', BUDGET)))
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'budgets', BUDGET)))
  })
})

describe('invites', () => {
  async function seedInvite(code, data = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', code), {
        budgetId: BUDGET,
        createdBy: OWNER,
        active: true,
        expiresAt: future(),
        ...data,
      })
    })
  }

  it('רק חבר בתקציב יוצר הזמנה', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'invites', 'CODE1'), {
        budgetId: BUDGET, createdBy: OWNER, active: true, expiresAt: future(),
      }),
    )
    await assertFails(
      setDoc(doc(as(STRANGER), 'invites', 'CODE2'), {
        budgetId: BUDGET, createdBy: STRANGER, active: true, expiresAt: future(),
      }),
    )
  })

  it('אי אפשר ליצור הזמנה שכבר פגה', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'invites', 'CODE3'), {
        budgetId: BUDGET, createdBy: OWNER, active: true, expiresAt: past(),
      }),
    )
  })

  it('אי אפשר לסרוק את רשימת ההזמנות', async () => {
    await seedInvite('CODE4')
    const { getDocs, collection } = await import('firebase/firestore')
    await assertFails(getDocs(collection(as(STRANGER), 'invites')))
  })

  it('הצטרפות עם קוד תקף מצרפת את המזמין ומכבה את הקוד', async () => {
    await seedInvite('GOODCODE')
    const db = as(PARTNER)
    const batch = writeBatch(db)
    batch.set(doc(db, 'budgets', BUDGET, 'members', PARTNER), {
      uid: PARTNER, role: 'member', inviteCode: 'GOODCODE',
    })
    batch.set(doc(db, 'users', PARTNER, 'memberships', BUDGET), { budgetId: BUDGET })
    batch.update(doc(db, 'invites', 'GOODCODE'), { active: false, usedBy: PARTNER })
    await assertSucceeds(batch.commit())

    await assertSucceeds(getDoc(doc(as(PARTNER), 'budgets', BUDGET)))
  })

  it('קוד שנוצל כבר לא מצרף', async () => {
    await seedInvite('USEDCODE', { active: false })
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member', inviteCode: 'USEDCODE',
      }),
    )
  })

  it('קוד שפג תוקפו לא מצרף', async () => {
    await seedInvite('OLDCODE', { expiresAt: past() })
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member', inviteCode: 'OLDCODE',
      }),
    )
  })

  it('קוד של תקציב אחר לא מצרף לתקציב הזה', async () => {
    await seedInvite('OTHERCODE', { budgetId: 'some-other-budget' })
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member', inviteCode: 'OTHERCODE',
      }),
    )
  })

  it('בלי קוד בכלל אי אפשר להצטרף', async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), 'budgets', BUDGET, 'members', STRANGER), {
        uid: STRANGER, role: 'member',
      }),
    )
  })

  it('אי אפשר לצרף מישהו אחר עם קוד תקף', async () => {
    await seedInvite('GOODCODE')
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', STRANGER), {
        uid: STRANGER, role: 'member', inviteCode: 'GOODCODE',
      }),
    )
  })

  it('אי אפשר להחיות הזמנה שכובתה', async () => {
    await seedInvite('DEADCODE', { active: false })
    await assertFails(updateDoc(doc(as(OWNER), 'invites', 'DEADCODE'), { active: true }))
  })

  it('אי אפשר להאריך תוקף של הזמנה קיימת', async () => {
    await seedInvite('CODE5')
    await assertFails(
      updateDoc(doc(as(OWNER), 'invites', 'CODE5'), {
        active: false,
        expiresAt: Timestamp.fromMillis(Date.now() + 999999999),
      }),
    )
  })
})

describe('members', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })
  })

  it('חבר עוזב את עצמו', async () => {
    await assertSucceeds(deleteDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER)))
  })

  it('הבעלים מסיר חבר, חבר לא מסיר את הבעלים', async () => {
    await assertFails(deleteDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', OWNER)))
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'budgets', BUDGET, 'members', PARTNER)))
  })

  it('הבעלים לא יכול להסיר את עצמו ולהשאיר תקציב יתום', async () => {
    await assertFails(deleteDoc(doc(as(OWNER), 'budgets', BUDGET, 'members', OWNER)))
  })
})

describe('memberships index', () => {
  it('כל אחד כותב וקורא רק את העץ של עצמו', async () => {
    await assertSucceeds(
      setDoc(doc(as(PARTNER), 'users', PARTNER, 'memberships', BUDGET), { budgetId: BUDGET }),
    )
    await assertFails(
      setDoc(doc(as(STRANGER), 'users', PARTNER, 'memberships', BUDGET), { budgetId: BUDGET }),
    )
    await assertFails(getDoc(doc(as(STRANGER), 'users', PARTNER, 'memberships', BUDGET)))
  })
})

describe('entries', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'entries', 'e1'), entry())
    })
  })

  it('חבר קורא וכותב, זר לא', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'entries', 'e1')))
    await assertFails(getDoc(doc(as(STRANGER), 'entries', 'e1')))
    await assertFails(setDoc(doc(as(STRANGER), 'entries', 'e2'), entry({ addedBy: STRANGER })))
  })

  it('addedBy חייב להיות המשתמש עצמו', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e3'), entry({ addedBy: PARTNER })))
  })

  it('דוחה קטגוריה לא חוקית', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e4'), entry({ category: 'crypto' })))
  })

  it('דוחה סכום שלילי', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e5'), entry({ actualAmount: -1 })))
  })

  it('דוחה פורמט חודש שגוי', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e6'), entry({ month: '2026-9' })))
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e7'), entry({ month: 'ספטמבר' })))
  })

  it('דוחה סכום כמחרוזת', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'entries', 'e8'), entry({ actualAmount: '5000' })))
  })

  it('אי אפשר להעביר רשומה לתקציב אחר', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'entries', 'e1'), { budgetId: 'other' }))
  })

  it('אי אפשר לשנות מי הזין את הרשומה', async () => {
    await assertFails(updateDoc(doc(as(PARTNER), 'entries', 'e1'), { addedBy: PARTNER }))
  })
})

describe('entries query (list)', () => {
  it('חבר יכול להריץ את שאילתת החודש כשאין עדיין רשומות', async () => {
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    await assertSucceeds(
      getDocs(query(
        collection(as(OWNER), 'entries'),
        where('budgetId', '==', BUDGET),
        where('month', '==', '2026-09'),
      )),
    )
  })

  it('חבר יכול להריץ את שאילתת החודש כשיש רשומות', async () => {
    const { getDocs, collection, query, where, setDoc: set } = await import('firebase/firestore')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(doc(context.firestore(), 'entries', 'q1'), entry())
    })
    await assertSucceeds(
      getDocs(query(
        collection(as(OWNER), 'entries'),
        where('budgetId', '==', BUDGET),
        where('month', '==', '2026-09'),
      )),
    )
  })

  it('זר לא יכול להריץ את אותה שאילתה', async () => {
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    await assertFails(
      getDocs(query(
        collection(as(STRANGER), 'entries'),
        where('budgetId', '==', BUDGET),
        where('month', '==', '2026-09'),
      )),
    )
  })
})

describe('recurring templates', () => {
  const template = (overrides = {}) => ({
    category: 'fixed',
    budgetGroup: 'fixed',
    name: 'שכר דירה',
    plannedAmount: 5500,
    actualAmount: 5500,
    startMonth: '2026-09',
    active: true,
    skipMonths: [],
    createdBy: OWNER,
    ...overrides,
  })

  it('חבר יוצר וקורא תבנית, זר לא', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't1'), template()),
    )
    await assertFails(
      setDoc(doc(as(STRANGER), 'budgets', BUDGET, 'recurring', 't2'), template({ createdBy: STRANGER })),
    )
    await assertFails(getDoc(doc(as(STRANGER), 'budgets', BUDGET, 'recurring', 't1')))
  })

  it('דוחה תבנית עם קטגוריה או חודש לא חוקיים', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't3'), template({ category: 'x' })),
    )
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't4'), template({ startMonth: '2026-9' })),
    )
  })

  it('אי אפשר להזיז את חודש ההתחלה של תבנית קיימת', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'recurring', 't5'), template())
    })
    await assertFails(
      updateDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't5'), { startMonth: '2026-01' }),
    )
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't5'), { skipMonths: ['2026-10'] }),
    )
  })

  it('אפשר לכבות תבנית', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'recurring', 't6'), template())
    })
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't6'), { active: false }),
    )
  })
})

describe('רישום מכשירים להתראות', () => {
  const TOKEN = 'fcm-token-abc123'

  it('כל אחד כותב וקורא רק את המכשירים של עצמו', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'users', OWNER, 'devices', TOKEN), { token: TOKEN }),
    )
    await assertSucceeds(getDoc(doc(as(OWNER), 'users', OWNER, 'devices', TOKEN)))
    await assertFails(getDoc(doc(as(PARTNER), 'users', OWNER, 'devices', TOKEN)))
    await assertFails(
      setDoc(doc(as(PARTNER), 'users', OWNER, 'devices', TOKEN), { token: TOKEN }),
    )
  })

  it('אנונימי לא נוגע בכלל', async () => {
    await assertFails(getDoc(doc(anon(), 'users', OWNER, 'devices', TOKEN)))
  })

  it('אפשר להסיר מכשיר של עצמך', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', OWNER, 'devices', TOKEN), { token: TOKEN })
    })
    await assertFails(deleteDoc(doc(as(PARTNER), 'users', OWNER, 'devices', TOKEN)))
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'users', OWNER, 'devices', TOKEN)))
  })
})

describe('עדכון שם החבר', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })
  })

  it('אפשר להשלים את השם של עצמך', async () => {
    await assertSucceeds(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), { displayName: 'נועה' }),
    )
  })

  it('אי אפשר לשנות שם של מישהו אחר', async () => {
    await assertFails(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', OWNER), { displayName: 'נועה' }),
    )
  })

  it('אי אפשר להפוך את עצמך לבעלים דרך העדכון הזה', async () => {
    await assertFails(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        displayName: 'נועה', role: 'owner',
      }),
    )
  })

  it('אי אפשר להחליף זהות במסמך החבר', async () => {
    await assertFails(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        displayName: 'נועה', uid: OWNER,
      }),
    )
  })

  it('שם ארוך מדי נדחה', async () => {
    await assertFails(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'members', PARTNER), {
        displayName: 'א'.repeat(61),
      }),
    )
  })
})

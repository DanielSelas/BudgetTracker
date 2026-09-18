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
    await setDoc(doc(db, 'budgets', BUDGET), { name: 'משפחתי', ownerUid: OWNER, type: 'household' })
    await setDoc(doc(db, 'budgets', BUDGET, 'members', OWNER), { uid: OWNER, role: 'owner' })
  })
})

const as = (uid) => testEnv.authenticatedContext(uid).firestore()
// הכלל משווה מייל מול הטוקן, ולכן צריך הקשר שיש בו מייל
const asEmail = (uid, email) => testEnv.authenticatedContext(uid, { email }).firestore()
const anon = () => testEnv.unauthenticatedContext().firestore()

describe('budgets', () => {
  it('חבר קורא את התקציב, זר לא', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'budgets', BUDGET)))
    await assertFails(getDoc(doc(as(STRANGER), 'budgets', BUDGET)))
    await assertFails(getDoc(doc(anon(), 'budgets', BUDGET)))
  })

  it('יצירת תקציב רק עם ownerUid של עצמך', async () => {
    await assertSucceeds(
      setDoc(doc(as(PARTNER), 'budgets', 'b2'), { name: 'שלי', ownerUid: PARTNER, type: 'household' }),
    )
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 'b3'), { name: 'גניבה', ownerUid: OWNER, type: 'household' }),
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

  // הבעלים כן יכול, כי מחיקת תקציב מוחקת את מסמך החבר שלו באותה כתיבה
  it('הבעלים יכול להסיר את מסמך החבר של עצמו', async () => {
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'budgets', BUDGET, 'members', OWNER)))
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
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'entries', 'e1'), entry())
    })
  })

  it('חבר קורא וכותב, זר לא', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e1')))
    await assertFails(getDoc(doc(as(STRANGER), 'budgets', BUDGET, 'entries', 'e1')))
    await assertFails(setDoc(doc(as(STRANGER), 'budgets', BUDGET, 'entries', 'e2'), entry({ addedBy: STRANGER })))
  })

  it('addedBy חייב להיות המשתמש עצמו', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e3'), entry({ addedBy: PARTNER })))
  })

  it('דוחה קטגוריה לא חוקית', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e4'), entry({ category: 'crypto' })))
  })

  it('מקבל סכום שלילי, כי זיכוי הוא הוצאה שקוזזה', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e5'), entry({ actualAmount: -150 })),
    )
  })

  it('אבל מתוכנן שלילי עדיין נדחה, כי תכנון שלילי חסר משמעות', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e5b'), entry({ plannedAmount: -1 })),
    )
  })

  it('דוחה פורמט חודש שגוי', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e6'), entry({ month: '2026-9' })))
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e7'), entry({ month: 'ספטמבר' })))
  })

  it('דוחה סכום כמחרוזת', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e8'), entry({ actualAmount: '5000' })))
  })


  it('אי אפשר לשנות מי הזין את הרשומה', async () => {
    await assertFails(updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'entries', 'e1'), { addedBy: PARTNER }))
  })

  // בלי בדיקה כזו אפשר לשבור עדכון לגמרי ולא לשים לב, כי כל השאר מאמתות דחיות
  it('חבר יכול לעדכן סכום של שורה קיימת', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'e1'), { actualAmount: 6000 }))
  })
})

describe('entries query (list)', () => {
  it('חבר יכול להריץ את שאילתת החודש כשאין עדיין רשומות', async () => {
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    await assertSucceeds(
      getDocs(query(
        collection(as(OWNER), 'budgets', BUDGET, 'entries'),
        where('budgetId', '==', BUDGET),
        where('month', '==', '2026-09'),
      )),
    )
  })

  it('חבר יכול להריץ את שאילתת החודש כשיש רשומות', async () => {
    const { getDocs, collection, query, where, setDoc: set } = await import('firebase/firestore')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await set(doc(context.firestore(), 'budgets', BUDGET, 'entries', 'q1'), entry())
    })
    await assertSucceeds(
      getDocs(query(
        collection(as(OWNER), 'budgets', BUDGET, 'entries'),
        where('budgetId', '==', BUDGET),
        where('month', '==', '2026-09'),
      )),
    )
  })

  it('זר לא יכול להריץ את אותה שאילתה', async () => {
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    await assertFails(
      getDocs(query(
        collection(as(STRANGER), 'budgets', BUDGET, 'entries'),
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

describe('רשומת שארית', () => {
  it('מתקבלת כקטגוריה חוקית', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'u1'), entry({
        category: 'unplanned', budgetGroup: 'none', name: 'תיקון רכב', actualAmount: 1500,
      })),
    )
  })

  it('עדיין דוחה קטגוריה מומצאת', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'u2'), entry({ category: 'misc', budgetGroup: 'none' })),
    )
  })
})

describe('סוגי תקציב ותאריכים', () => {
  it('יצירת תקציב מחייבת סוג חוקי', async () => {
    await assertSucceeds(
      setDoc(doc(as(PARTNER), 'budgets', 't-ok'), {
        name: 'יוון', ownerUid: PARTNER, type: 'trip', frame: 12000,
      }),
    )
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 't-bad'), {
        name: 'יוון', ownerUid: PARTNER, type: 'vacation', frame: 12000,
      }),
    )
  })

  it('טיול חייב מסגרת מספרית', async () => {
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 't-noframe'), {
        name: 'יוון', ownerUid: PARTNER, type: 'trip',
      }),
    )
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 't-strframe'), {
        name: 'יוון', ownerUid: PARTNER, type: 'trip', frame: '12000',
      }),
    )
  })

  it('אי אפשר לשנות סוג של תקציב קיים', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { type: 'trip' }))
  })

  // תקציבים שנוצרו לפני שהיה שדה type חייבים להישאר ניתנים לעדכון
  it('תקציב ישן בלי שדה type עדיין ניתן לעדכון', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'budgets', 'legacy'), { name: 'ישן', ownerUid: OWNER })
      await setDoc(doc(db, 'budgets', 'legacy', 'members', OWNER), { uid: OWNER, role: 'owner' })
    })
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', 'legacy'), { name: 'ישן ומעודכן' }))
  })

  it('מקבל קטגוריות טיול', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'tr1'), entry({
        category: 'lodging', budgetGroup: 'none', name: 'מלון', date: '2026-09-04',
      })),
    )
  })

  it('תאריך שלא מתיישב עם החודש נדחה', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'tr2'), entry({
        category: 'lodging', budgetGroup: 'none', month: '2026-09', date: '2026-10-04',
      })),
    )
  })

  it('תאריך בפורמט שגוי נדחה', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'tr3'), entry({
        category: 'lodging', budgetGroup: 'none', date: '04/09/2026',
      })),
    )
  })

  it('רשומה בלי תאריך עדיין תקפה', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'tr4'), entry({ category: 'fixed' })),
    )
  })
})

describe('שורה מסכמת של טיול', () => {
  const rollup = (overrides = {}) => entry({
    category: 'unplanned',
    budgetGroup: 'none',
    name: 'טיול: יוון',
    actualAmount: 4650,
    linkedTripId: 'trip-1',
    ...overrides,
  })

  it('חבר בתקציב הבית יכול לכתוב אותה', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'trip_trip-1__2026-09'), rollup()),
    )
  })

  it('מי שאינו חבר בתקציב הבית לא יכול', async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), 'budgets', BUDGET, 'entries', 'trip_trip-1__2026-09'), rollup({ addedBy: STRANGER })),
    )
  })

  it('שותף אחר יכול לעדכן את הסכום בלי לגעת במי שיצר', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'budgets', BUDGET, 'entries', 'trip_trip-1__2026-09'), rollup())
      await setDoc(doc(db, 'budgets', BUDGET, 'members', PARTNER), { uid: PARTNER, role: 'member' })
    })
    await assertSucceeds(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'entries', 'trip_trip-1__2026-09'), { actualAmount: 5000 }),
    )
    await assertFails(
      updateDoc(doc(as(PARTNER), 'budgets', BUDGET, 'entries', 'trip_trip-1__2026-09'), { addedBy: PARTNER }),
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

describe('קריאת מסמך שאינו קיים', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'entries', 'קיים'), entry())
    })
  })

  // בלי זה, יצירת שורה מסכמת של טיול נכשלת: הלקוח בודק אם היא קיימת,
  // והכלל נשבר על מסמך שטרם נוצר
  it('חבר יכול לבדוק אם שורה קיימת בלי שזה ייחשב הפרה', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'לא-קיים')))
  })

  it('זר עדיין לא קורא שורה שכן קיימת', async () => {
    await assertFails(getDoc(doc(as(STRANGER), 'budgets', BUDGET, 'entries', 'קיים')))
  })
})

describe('מחיקת תקציב', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'entries', 'e1'), entry())
    })
  })

  it('הבעלים מוחק את התקציב ואת מה שתלוי בו', async () => {
    const db = as(OWNER)
    const batch = writeBatch(db)
    batch.delete(doc(db, 'budgets', BUDGET, 'entries', 'e1'))
    batch.delete(doc(db, 'users', OWNER, 'memberships', BUDGET))
    batch.delete(doc(db, 'budgets', BUDGET, 'members', OWNER))
    batch.delete(doc(db, 'budgets', BUDGET))
    await assertSucceeds(batch.commit())
  })

  it('מי שאינו הבעלים לא מוחק את התקציב', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })
    await assertFails(deleteDoc(doc(as(PARTNER), 'budgets', BUDGET)))
  })
})

describe('שורה מסכמת מקצה לקצה', () => {
  // מדמה בדיוק את מה ש-syncRollup עושה: בודק אם קיימת, ואז יוצר
  it('יצירה של שורה מסכמת חדשה עוברת', async () => {
    const db = as(OWNER)
    const ref = doc(db, 'budgets', BUDGET, 'entries', 'trip_abc__2026-09')

    const existing = await getDoc(ref)
    expect(existing.exists()).toBe(false)

    await assertSucceeds(setDoc(ref, {
      budgetId: BUDGET,
      month: '2026-09',
      category: 'unplanned',
      budgetGroup: 'none',
      name: 'טיול: איטליה',
      plannedAmount: 0,
      actualAmount: 5000,
      note: '',
      addedBy: OWNER,
      linkedTripId: 'abc',
    }))

    const after = await getDoc(ref)
    expect(after.data().actualAmount).toBe(5000)
  })
})

describe('מטרת חיסכון', () => {
  it('יצירה מחייבת סכום יעד מספרי', async () => {
    await assertSucceeds(
      setDoc(doc(as(PARTNER), 'budgets', 'g-ok'), {
        name: 'רכב', ownerUid: PARTNER, type: 'goal', frame: 20000,
      }),
    )
    await assertFails(
      setDoc(doc(as(PARTNER), 'budgets', 'g-bad'), {
        name: 'רכב', ownerUid: PARTNER, type: 'goal',
      }),
    )
  })

  it('מקבל הפקדה ומשיכה כקטגוריות', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g1'), entry({
        category: 'deposit', budgetGroup: 'none', name: 'הפקדה',
      })),
    )
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g2'), entry({
        category: 'withdrawal', budgetGroup: 'none', name: 'משיכה',
      })),
    )
  })
})

describe('שורה מסכמת של מטרת חיסכון', () => {
  const rollup = (overrides = {}) => entry({
    category: 'fund',
    budgetGroup: 'savings',
    name: 'חיסכון: רכב חדש',
    plannedAmount: 0,
    actualAmount: 1500,
    linkedTripId: 'goal-1',
    ...overrides,
  })

  it('חבר בתקציב הבית יכול לכתוב אותה לקרן', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'trip_goal-1__2026-09'), rollup()),
    )
  })

  it('עדכון הסכום בלי לגעת במי שיצר', async () => {
    const ref = doc(as(OWNER), 'budgets', BUDGET, 'entries', 'trip_goal-1__2026-09')
    await setDoc(ref, rollup())
    await assertSucceeds(updateDoc(ref, { actualAmount: 2500 }))
  })
})

describe('קישור תקציב מסגרת בדיעבד', () => {
  it('חבר יכול להוסיף קישור לתקציב קיים', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'budgets', 'goal-1'), {
        name: 'רכב', ownerUid: OWNER, type: 'goal', frame: 20000, linkedBudgetId: null,
      })
      await setDoc(doc(db, 'budgets', 'goal-1', 'members', OWNER), { uid: OWNER, role: 'owner' })
    })
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'budgets', 'goal-1'), { linkedBudgetId: BUDGET }),
    )
    await assertFails(
      updateDoc(doc(as(STRANGER), 'budgets', 'goal-1'), { linkedBudgetId: BUDGET }),
    )
  })
})

describe('קיבוץ שורות בתוך קטגוריה', () => {
  it('שם קיבוץ תקין מתקבל', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g-ok'), entry({ groupKey: 'קניות בסופר' })),
    )
  })

  it('רשומה בלי קיבוץ ממשיכה לעבוד', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g-none'), entry()))
  })

  it('שם ריק או ארוך מדי נדחה', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g-empty'), entry({ groupKey: '' })),
    )
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g-long'), entry({ groupKey: 'א'.repeat(41) })),
    )
  })

  it('שם שאינו מחרוזת נדחה', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'g-num'), entry({ groupKey: 7 })),
    )
  })
})

describe('רשומות כתת אוסף של התקציב', () => {
  const nested = (id) => doc(as(OWNER), 'budgets', BUDGET, 'entries', id)
  // התקציב בנתיב, ולכן אינו שדה במסמך
  const item = (overrides = {}) => {
    const base = entry(overrides)
    delete base.budgetId
    return base
  }

  it('חבר בתקציב כותב וקורא', async () => {
    await assertSucceeds(setDoc(nested('n1'), item()))
    await assertSucceeds(getDoc(nested('n1')))
  })

  it('מי שאינו חבר נחסם בשני הכיוונים', async () => {
    const his = doc(as(STRANGER), 'budgets', BUDGET, 'entries', 'n2')
    await assertFails(setDoc(his, item({ addedBy: STRANGER })))
    await assertFails(getDoc(his))
  })

  it('הולידציה נשמרה', async () => {
    await assertFails(setDoc(nested('n3'), item({ category: 'crypto' })))
    await assertFails(setDoc(nested('n4'), item({ plannedAmount: -1 })))
    await assertFails(setDoc(nested('n5'), item({ month: 'ספטמבר' })))
    await assertFails(setDoc(nested('n6'), item({ date: '2026-08-02' })))
    await assertFails(setDoc(nested('n7'), item({ groupKey: '' })))
  })

  it('תאריך שמתיישב עם החודש מתקבל', async () => {
    await assertSucceeds(setDoc(nested('n8'), item({ date: '2026-09-02' })))
  })

  it('אי אפשר לזייף מי הזין, לא ביצירה ולא בעדכון', async () => {
    await assertFails(setDoc(nested('n9'), item({ addedBy: PARTNER })))
    await setDoc(nested('n10'), item())
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })
    const asPartner = doc(as(PARTNER), 'budgets', BUDGET, 'entries', 'n10')
    await assertSucceeds(updateDoc(asPartner, { actualAmount: 6000 }))
    await assertFails(updateDoc(asPartner, { addedBy: PARTNER }))
  })

  it('קריאה של מסמך שאינו קיים אינה נכשלת', async () => {
    await assertSucceeds(getDoc(nested('אין-כזה')))
  })

  it('שורה מסכמת של טיול נכתבת לתת האוסף של תקציב הבית', async () => {
    await assertSucceeds(setDoc(nested('trip_t1__2026-09'), item({
      category: 'unplanned', budgetGroup: 'none', name: 'טיול: יוון', linkedTripId: 't1',
    })))
  })
})

describe('מיגרציה: העתקת רשומות של שותף', () => {
  it('חבר מעתיק רשומה שהשותף הזין, ושומר על מי שהזין אותה', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })
    const body = entry({ addedBy: PARTNER })
    delete body.budgetId
    // זה בדיוק מה שהמיגרציה עושה: הבעלים כותב שורה של השותף
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'copied'), body),
    )
  })
})

describe('מיגרציה: אצווה גדולה', () => {
  it('אצווה של 150 רשומות משני מחברים עוברת', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'budgets', BUDGET, 'members', PARTNER), {
        uid: PARTNER, role: 'member',
      })
    })

    // כל כתיבה גוררת בדיקת חברות, ולכן זו גם בדיקה שהאצווה לא חורגת
    // ממספר הגישות למסמכים שמותר בכלל אחד
    const db = as(OWNER)
    const batch = writeBatch(db)
    for (let index = 0; index < 150; index += 1) {
      const body = entry({ addedBy: index % 2 ? PARTNER : OWNER, name: `שורה ${index}` })
      delete body.budgetId
      batch.set(doc(db, 'budgets', BUDGET, 'entries', `bulk-${index}`), body)
    }
    await assertSucceeds(batch.commit())
  })

  it('אי אפשר לייחס רשומה למי שאינו חבר בתקציב', async () => {
    const body = entry({ addedBy: STRANGER })
    delete body.budgetId
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'forged'), body),
    )
  })
})

describe('מועד חיוב', () => {
  const household = (overrides = {}) => ({
    name: 'הבית', ownerUid: PARTNER, type: 'household', ...overrides,
  })

  it('יום תקין מתקבל, וגם היעדר השדה', async () => {
    await assertSucceeds(setDoc(doc(as(PARTNER), 'budgets', 'b-10'), household({ billingDay: 10 })))
    await assertSucceeds(setDoc(doc(as(PARTNER), 'budgets', 'b-none'), household()))
  })

  it('יום שאינו קיים בכל חודש נדחה', async () => {
    await assertFails(setDoc(doc(as(PARTNER), 'budgets', 'b-31'), household({ billingDay: 31 })))
    await assertFails(setDoc(doc(as(PARTNER), 'budgets', 'b-0'), household({ billingDay: 0 })))
    await assertFails(setDoc(doc(as(PARTNER), 'budgets', 'b-str'), household({ billingDay: '10' })))
  })

  it('חבר יכול לשנות אותו אחר כך', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { billingDay: 15 }))
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { billingDay: 31 }))
  })
})

describe('סכום בסיס מתוכנן', () => {
  it('מספר אי שלילי מתקבל, וגם היעדר השדה', async () => {
    await assertSucceeds(setDoc(doc(as(PARTNER), 'budgets', 'b-base'), {
      name: 'הבית', ownerUid: PARTNER, type: 'household', baseAmount: 20000,
    }))
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { baseAmount: 0 }))
  })

  it('סכום שלילי או טקסט נדחים', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { baseAmount: -1 }))
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { baseAmount: '20000' }))
  })
})

describe('הפקדה מהיתרה', () => {
  it('הדגל מתקבל כשהוא אמת', async () => {
    const body = entry({ category: 'fund', budgetGroup: 'savings', fromRemainder: true })
    delete body.budgetId
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'r1'), body))
  })

  it('שקר או ערך שאינו בוליאני נדחים', async () => {
    for (const value of [false, 'true', 1]) {
      const body = entry({ category: 'fund', budgetGroup: 'savings', fromRemainder: value })
      delete body.budgetId
      await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'r2'), body))
    }
  })
})

describe('פרופיל משתמש', () => {
  it('כותבים רק את הפרופיל של עצמכם', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER), { displayName: 'דניאל', tone: 'a1' }))
    await assertFails(setDoc(doc(as(OWNER), 'users', PARTNER), { displayName: 'נועה' }))
  })

  it('שותף יכול לקרוא פרופיל, אחרת לא היה רואה מי הזין שורה', async () => {
    await setDoc(doc(as(OWNER), 'users', OWNER), { displayName: 'דניאל', tone: 'a1' })
    await assertSucceeds(getDoc(doc(as(PARTNER), 'users', OWNER)))
  })

  it('אי אפשר לסרוק את כל המשתמשים', async () => {
    const { getDocs, collection } = await import('firebase/firestore')
    await assertFails(getDocs(collection(as(STRANGER), 'users')))
  })

  it('שם ארוך מדי או גוון שאינו מחרוזת נדחים', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), { displayName: 'א'.repeat(61) }))
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), { displayName: 'דניאל', tone: 7 }))
  })

  it('מי שאינו מחובר לא קורא ולא כותב', async () => {
    const anon = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'users', OWNER)))
    await assertFails(setDoc(doc(anon, 'users', OWNER), { displayName: 'זר' }))
  })
})

describe('יצירת תקציב עם מזהה קריא', () => {
  it('מזהה קריא מתקבל כמו כל מזהה אחר', async () => {
    await assertSucceeds(setDoc(doc(as(PARTNER), 'budgets', 'trip_איטליה_qkmubg'), {
      name: 'איטליה', ownerUid: PARTNER, type: 'trip', frame: 5000, linkedBudgetId: null,
    }))
  })

  it('שדה rekeyedFrom אינו מפריע לוולידציה', async () => {
    await assertSucceeds(setDoc(doc(as(PARTNER), 'budgets', 'household_הבית_x1'), {
      name: 'הבית', ownerUid: PARTNER, type: 'household',
      billingDay: 10, baseAmount: 20000, rekeyedFrom: 'oldRandomId',
    }))
  })
})

describe('מייל לקריאה אנושית', () => {
  const MAIL = 'partner@example.com'

  it('הבעלים שומר את המייל שלו על התקציב', async () => {
    await assertSucceeds(setDoc(doc(asEmail(PARTNER, MAIL), 'budgets', 'b-mail'), {
      name: 'הבית', ownerUid: PARTNER, type: 'household', ownerEmail: MAIL,
    }))
  })

  it('אי אפשר לשתול מייל של מישהו אחר', async () => {
    await assertFails(setDoc(doc(asEmail(PARTNER, MAIL), 'budgets', 'b-fake'), {
      name: 'הבית', ownerUid: PARTNER, type: 'household',
      ownerEmail: 'someone.else@example.com',
    }))
  })

  it('תקציב בלי השדה ממשיך לעבוד', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', BUDGET), { name: 'הבית שלנו' }))
  })

  it('חבר שומר את המייל שלו במסמך החברות', async () => {
    const mine = 'owner@example.com'
    await assertSucceeds(updateDoc(doc(asEmail(OWNER, mine), 'budgets', BUDGET, 'members', OWNER), {
      displayName: 'דניאל', email: mine,
    }))
    await assertFails(updateDoc(doc(asEmail(OWNER, mine), 'budgets', BUDGET, 'members', OWNER), {
      displayName: 'דניאל', email: 'someone.else@example.com',
    }))
  })
})

describe('רשימת חברים לתצוגה', () => {
  it('חבר מעדכן את הרשימה', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'budgets', BUDGET), {
      memberEmails: ['a@example.com', 'b@example.com'],
    }))
  })

  it('רשימה ארוכה מדי או שאינה רשימה נדחות', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), {
      memberEmails: Array.from({ length: 21 }, (_, i) => `u${i}@example.com`),
    }))
    await assertFails(updateDoc(doc(as(OWNER), 'budgets', BUDGET), {
      memberEmails: 'a@example.com',
    }))
  })

  it('מי שאינו חבר לא נוגע בה', async () => {
    await assertFails(updateDoc(doc(as(STRANGER), 'budgets', BUDGET), {
      memberEmails: ['hacker@example.com'],
    }))
  })
})

describe('סיום לחיוב קבוע', () => {
  const template = (extra = {}) => ({
    category: 'fixed', budgetGroup: 'fixed', name: 'שכר דירה',
    plannedAmount: 5200, actualAmount: 5200, startMonth: '2026-09',
    active: true, skipMonths: [], createdBy: OWNER, ...extra,
  })

  it('חודש סיום תקין מתקבל, וגם היעדרו', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't1'),
      template({ endMonth: '2027-08' })))
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't2'),
      template()))
  })

  it('סיום לפני ההתחלה או בפורמט שגוי נדחה', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't3'),
      template({ endMonth: '2026-08' })))
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 't4'),
      template({ endMonth: 'אוגוסט' })))
  })
})

describe('חיוב שיורד ישירות מהחשבון', () => {
  const template = (extra = {}) => ({
    category: 'fixed', budgetGroup: 'fixed', name: 'שכר דירה',
    plannedAmount: 5200, actualAmount: 5200, startMonth: '2026-09',
    active: true, skipMonths: [], createdBy: OWNER, ...extra,
  })

  it('הדגל מתקבל כשהוא אמת, וגם כשאינו קיים', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 'o1'),
      template({ offCard: true })))
    await assertSucceeds(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 'o2'),
      template()))
  })

  it('שקר או ערך שאינו בוליאני נדחים', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 'o3'),
      template({ offCard: false })))
    await assertFails(setDoc(doc(as(OWNER), 'budgets', BUDGET, 'recurring', 'o4'),
      template({ offCard: 'yes' })))
  })
})

describe('שורה מיובאת', () => {
  const imported = (extra = {}) => {
    const base = entry({ date: '2026-09-03', groupKey: 'שופרסל דיל', imported: true, ...extra })
    delete base.budgetId
    return base
  }

  it('נכתבת כמו כל שורה, עם תאריך שמתיישב עם החודש', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'imp_1'), imported()),
    )
  })

  it('תאריך שאינו מתיישב עם החודש נדחה גם בייבוא', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'imp_2'),
        imported({ date: '2026-08-03' })),
    )
  })

  it('הדגל חייב להיות אמת אם הוא קיים', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'budgets', BUDGET, 'entries', 'imp_3'),
        imported({ imported: false })),
    )
  })
})

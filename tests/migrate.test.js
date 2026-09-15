import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: (...path) => ({ path }),
  doc: (...path) => ({ path }),
  getDocs: async () => ({ docs: [] }),
  query: (...parts) => parts,
  where: (...parts) => parts,
  writeBatch: () => ({ set: () => {}, delete: () => {}, commit: async () => {} }),
}))
vi.mock('../src/lib/firebase', () => ({ db: {} }))

const { entryId, isDerivedId } = await import('../src/lib/paths')
const { targetBody, targetId } = await import('../src/lib/migrate')

describe('מזהה קריא לרשומה', () => {
  const parts = (id) => id.split('_')

  it('מתחיל בחודש ובקטגוריה, כדי שהקונסולה תהיה ממוינת מאליה', () => {
    const id = entryId({ month: '2026-09', category: 'fixed', name: 'שכר דירה' })
    expect(parts(id)[0]).toBe('2026-09')
    expect(parts(id)[1]).toBe('fixed')
    expect(parts(id)[2]).toBe('שכר-דירה')
  })

  it('שתי רשומות זהות מקבלות מזהים שונים', () => {
    const same = { month: '2026-09', category: 'leisure', name: 'קפה' }
    expect(entryId(same)).not.toBe(entryId(same))
  })

  it('מסיר תווים שאסורים במזהה מסמך', () => {
    const id = entryId({ month: '2026-09', category: 'fixed', name: 'ביטוח/רכב #2' })
    expect(id).not.toContain('/')
    expect(id).not.toContain('#')
  })

  it('חותך שם ארוך במקום לייצר מזהה ענק', () => {
    const id = entryId({ month: '2026-09', category: 'fixed', name: 'א'.repeat(200) })
    expect(parts(id)[2].length).toBeLessThanOrEqual(40)
  })

  it('שורד שם ריק', () => {
    const id = entryId({ month: '2026-09', category: 'fund', name: '' })
    expect(id.startsWith('2026-09_fund_')).toBe(true)
  })
})

describe('שימור מזהים נגזרים', () => {
  it('מזהה של חיוב קבוע ושל שורה מסכמת מזוהה ככזה', () => {
    expect(isDerivedId('abc123__2026-09')).toBe(true)
    expect(isDerivedId('trip_t1__2026-09')).toBe(true)
    expect(isDerivedId('kJ3nR9xQ')).toBe(false)
  })

  it('מזהה נגזר עובר כלשונו, אחרת השורה תיווצר שוב בחודש הבא', () => {
    expect(targetId({ id: 'trip_t1__2026-09', month: '2026-09', category: 'unplanned', name: 'טיול' }))
      .toBe('trip_t1__2026-09')
    expect(targetId({ id: 'rec7__2026-09', month: '2026-09', category: 'fixed', name: 'שכר דירה' }))
      .toBe('rec7__2026-09')
  })

  it('מזהה אקראי מוחלף בקריא', () => {
    const next = targetId({ id: 'kJ3nR9xQ', month: '2026-09', category: 'fixed', name: 'חשמל' })
    expect(next).not.toBe('kJ3nR9xQ')
    expect(next.startsWith('2026-09_fixed_חשמל')).toBe(true)
  })
})

describe('גוף הרשומה במקום החדש', () => {
  const source = {
    id: 'kJ3nR9xQ',
    budgetId: 'b1',
    month: '2026-09',
    category: 'fixed',
    budgetGroup: 'fixed',
    name: 'שכר דירה',
    plannedAmount: 5200,
    actualAmount: 5200,
    addedBy: 'u1',
  }

  it('budgetId יורד, כי הוא נמצא עכשיו בנתיב', () => {
    expect(targetBody(source).budgetId).toBeUndefined()
  })

  it('המזהה אינו נשמר כשדה בתוך המסמך', () => {
    expect(targetBody(source).id).toBeUndefined()
  })

  it('כל השאר עובר בלי שינוי', () => {
    const body = targetBody(source)
    expect(body).toEqual({
      month: '2026-09',
      category: 'fixed',
      budgetGroup: 'fixed',
      name: 'שכר דירה',
      plannedAmount: 5200,
      actualAmount: 5200,
      addedBy: 'u1',
    })
  })

  it('שדות אופציונליים שורדים', () => {
    const body = targetBody({ ...source, groupKey: 'קניות בסופר', recurringId: 'r1', date: '2026-09-02' })
    expect(body.groupKey).toBe('קניות בסופר')
    expect(body.recurringId).toBe('r1')
    expect(body.date).toBe('2026-09-02')
  })
})

describe('מזהה יציב להעתקה', () => {
  it('אותה רשומה מקבלת אותו מזהה בכל הרצה, אחרת כל הרצה משכפלת', async () => {
    const { targetId } = await import('../src/lib/migrate')
    const item = { id: 'kJ3nR9xQ', month: '2026-09', category: 'fixed', name: 'חשמל' }
    expect(targetId(item)).toBe(targetId(item))
    expect(targetId(item)).toBe(targetId({ ...item }))
  })

  it('שתי רשומות שונות עם אותו תוכן עדיין נבדלות, לפי מזהה המקור', async () => {
    const { targetId } = await import('../src/lib/migrate')
    const base = { month: '2026-09', category: 'fund', name: 'הפקדה' }
    expect(targetId({ ...base, id: 'aaa' })).not.toBe(targetId({ ...base, id: 'bbb' }))
  })

  it('המזהה עדיין קריא ומתחיל בחודש ובקטגוריה', async () => {
    const { targetId } = await import('../src/lib/migrate')
    const id = targetId({ id: 'kJ3nR9xQ', month: '2026-09', category: 'fixed', name: 'חשמל' })
    expect(id.startsWith('2026-09_fixed_חשמל_')).toBe(true)
  })

  it('מזהה נגזר עדיין עובר כלשונו', async () => {
    const { targetId } = await import('../src/lib/migrate')
    expect(targetId({ id: 'trip_t1__2026-09', month: '2026-09', category: 'unplanned', name: 'טיול' }))
      .toBe('trip_t1__2026-09')
  })
})

describe('מזהים קריאים לתקציב ולחיוב קבוע', () => {
  it('התקציב מתחיל בסוג, כדי שהרשימה בקונסולה תהיה ממוינת לפי סוג', async () => {
    const { budgetId } = await import('../src/lib/paths')
    expect(budgetId({ type: 'trip', name: 'איטליה' }).startsWith('trip_איטליה_')).toBe(true)
    expect(budgetId({ type: 'goal', name: 'רכב חדש' }).startsWith('goal_רכב-חדש_')).toBe(true)
  })

  it('בלי סוג נופל למשק בית, ובלי שם עדיין מייצר מזהה תקין', async () => {
    const { budgetId } = await import('../src/lib/paths')
    expect(budgetId({ name: 'הבית' }).startsWith('household_')).toBe(true)
    expect(budgetId({ type: 'trip', name: '' }).startsWith('trip_')).toBe(true)
  })

  it('שני תקציבים באותו שם מקבלים מזהים שונים', async () => {
    const { budgetId } = await import('../src/lib/paths')
    const same = { type: 'trip', name: 'יוון' }
    expect(budgetId(same)).not.toBe(budgetId(same))
  })

  it('תווים אסורים במזהה מסמך מוסרים', async () => {
    const { budgetId } = await import('../src/lib/paths')
    const id = budgetId({ type: 'trip', name: 'יוון/כרתים #2' })
    expect(id).not.toContain('/')
    expect(id).not.toContain('#')
  })

  it('חיוב קבוע מקבל מזהה קריא לפי הקטגוריה והשם', async () => {
    const { recurringId } = await import('../src/lib/paths')
    expect(recurringId({ category: 'fixed', name: 'שכר דירה' })
      .startsWith('fixed-שכר-דירה-')).toBe(true)
  })
})

describe('זיהוי תקציבים שצריכים מזהה קריא', () => {
  it('מזהה אקראי מסומן להעברה, וקריא לא', async () => {
    const { alreadyReadable } = await import('../src/lib/rekey')
    expect(alreadyReadable('3s1KtlGpv2SSKliqamXf')).toBe(false)
    expect(alreadyReadable('trip_איטליה_qkmubg')).toBe(true)
    expect(alreadyReadable('household_תקציב-משפחתי_bc43zy')).toBe(true)
    expect(alreadyReadable('goal_רכב-חדש_tndiv1')).toBe(true)
  })

  it('המזהה המוצע נגזר מהסוג ומהשם', async () => {
    const { proposedId } = await import('../src/lib/rekey')
    expect(proposedId({ type: 'trip', name: 'איטליה' }).startsWith('trip_איטליה_')).toBe(true)
    expect(proposedId({ name: 'הבית' }).startsWith('household_הבית_')).toBe(true)
  })
})

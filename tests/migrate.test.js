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

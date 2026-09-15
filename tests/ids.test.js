import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: (...path) => ({ path }),
  doc: (...path) => ({ path }),
}))
vi.mock('../src/lib/firebase', () => ({ db: {} }))

const { budgetId, entryId, recurringId } = await import('../src/lib/paths')

/**
 * המזהים נועדו להיות קריאים בקונסולה של Firebase, ששם רואים רשימת
 * מסמכים ותו לא. לכן הסדר שלהם הוא מהכללי לפרטי.
 */
describe('מזהה קריא לרשומה', () => {
  const parts = (id) => id.split('_')

  it('חודש, קטגוריה, שם, וזנב', () => {
    const id = entryId({ month: '2026-09', category: 'fixed', name: 'שכר דירה' })
    expect(parts(id)[0]).toBe('2026-09')
    expect(parts(id)[1]).toBe('fixed')
    expect(parts(id)[2]).toBe('שכר-דירה')
    expect(parts(id)[3]).toHaveLength(6)
  })

  it('שתי קניות זהות הן שתי רשומות, ולכן מזהים שונים', () => {
    const same = { month: '2026-09', category: 'leisure', name: 'קפה' }
    expect(entryId(same)).not.toBe(entryId(same))
  })

  it('תווים שאסורים במזהה מסמך מוסרים', () => {
    const id = entryId({ month: '2026-09', category: 'fixed', name: 'ביטוח/רכב #2' })
    expect(id).not.toContain('/')
    expect(id).not.toContain('#')
  })

  it('שם ארוך נחתך, ושם ריק לא שובר', () => {
    expect(parts(entryId({ month: '2026-09', category: 'fixed', name: 'א'.repeat(200) }))[2])
      .toHaveLength(40)
    expect(entryId({ month: '2026-09', category: 'fund', name: '' }).startsWith('2026-09_fund_'))
      .toBe(true)
  })
})

describe('מזהה קריא לתקציב', () => {
  it('הסוג בהתחלה, כדי שהרשימה בקונסולה תהיה ממוינת לפי סוג', () => {
    expect(budgetId({ type: 'trip', name: 'איטליה' }).startsWith('trip_איטליה_')).toBe(true)
    expect(budgetId({ type: 'goal', name: 'רכב חדש' }).startsWith('goal_רכב-חדש_')).toBe(true)
    expect(budgetId({ name: 'הבית' }).startsWith('household_')).toBe(true)
  })

  it('שני תקציבים באותו שם נבדלים', () => {
    const same = { type: 'trip', name: 'יוון' }
    expect(budgetId(same)).not.toBe(budgetId(same))
  })
})

describe('מזהה קריא לחיוב קבוע', () => {
  it('קטגוריה ושם', () => {
    expect(recurringId({ category: 'fixed', name: 'שכר דירה' })
      .startsWith('fixed-שכר-דירה-')).toBe(true)
  })
})

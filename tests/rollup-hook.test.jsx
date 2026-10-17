import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const synced = []
vi.mock('../src/lib/firebase', () => ({ db: {} }))
vi.mock('../src/lib/trips', async () => {
  const real = await vi.importActual('../src/lib/trips')
  return {
    ...real,
    syncRollup: vi.fn(async (args) => { synced.push(args); return { synced: 1 } }),
  }
})

const { useTripRollup } = await import('../src/hooks/useTripRollup')

function Probe({ trip, entries, ready = true }) {
  useTripRollup({ trip, entries, uid: 'u1', ready })
  return null
}

const deposit = (month, actualAmount) => ({ category: 'deposit', month, actualAmount })

/**
 * הסנכרון רץ מתוך רכיב, ולכן השאלה אינה רק מה הוא כותב אלא מתי הוא
 * בכלל נקרא. כאן נבדקים המעברים: קישור אחרי שכבר יש הפקדות, והפקדה
 * נוספת אחרי שהקישור קיים.
 */
describe('מתי הגלגול מסתנכרן', () => {
  beforeEach(() => { synced.length = 0 })

  it('הפקדה נוספת מפעילה סנכרון', () => {
    const goal = { id: 'g1', type: 'goal', name: 'רכב', linkedBudgetId: 'home' }
    const { rerender } = render(<Probe trip={goal} entries={[deposit('2026-09', 1000)]} />)
    expect(synced).toHaveLength(1)

    rerender(<Probe trip={goal} entries={[deposit('2026-09', 1000), deposit('2026-09', 500)]} />)
    expect(synced).toHaveLength(2)
    expect(synced[1].entries).toHaveLength(2)
  })

  it('קישור אחרי שכבר יש הפקדות מסנכרן אותן', () => {
    const entries = [deposit('2026-09', 1000)]
    const unlinked = { id: 'g1', type: 'goal', name: 'רכב', linkedBudgetId: null }
    const { rerender } = render(<Probe trip={unlinked} entries={entries} />)
    expect(synced).toHaveLength(0)

    rerender(<Probe trip={{ ...unlinked, linkedBudgetId: 'home' }} entries={entries} />)
    expect(synced).toHaveLength(1)
  })

  it('החלפת התקציב המקושר מסנכרנת אל החדש', () => {
    const entries = [deposit('2026-09', 1000)]
    const goal = { id: 'g1', type: 'goal', name: 'רכב', linkedBudgetId: 'home' }
    const { rerender } = render(<Probe trip={goal} entries={entries} />)
    expect(synced).toHaveLength(1)

    rerender(<Probe trip={{ ...goal, linkedBudgetId: 'other' }} entries={entries} />)
    expect(synced).toHaveLength(2)
    expect(synced[1].trip.linkedBudgetId).toBe('other')
  })
})

describe('כישלון סנכרון', () => {
  beforeEach(() => { synced.length = 0 })

  /**
   * בלי איפוס החתימה, ניסיון שנכשל לא חוזר לעולם: כל ריצה נוספת
   * רואה את אותה חתימה ומדלגת, והשורה בבית נשארת חסרה בשקט.
   */
  it('ניסיון שנכשל חוזר במקום להישאר תקוע', async () => {
    const trips = await import('../src/lib/trips')
    trips.syncRollup.mockImplementationOnce(async (args) => {
      synced.push(args)
      throw new Error('permission-denied')
    })

    const goal = { id: 'g1', type: 'goal', name: 'רכב', linkedBudgetId: 'home' }
    const entries = [deposit('2026-09', 1000)]
    const { rerender } = render(<Probe trip={goal} entries={entries} />)
    expect(synced).toHaveLength(1)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // אותה חתימה בדיוק, ובכל זאת מנסים שוב כי הכישלון איפס אותה
    rerender(<Probe trip={goal} entries={[...entries]} />)
    expect(synced).toHaveLength(2)
  })
})

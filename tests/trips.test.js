import { describe, expect, it } from 'vitest'
import { rollupEntryId, totalsByMonth } from '../src/lib/trips'

const e = (month, actualAmount) => ({ month, actualAmount })

describe('rollupEntryId', () => {
  it('יציב וייחודי לכל שילוב של טיול וחודש', () => {
    expect(rollupEntryId('t1', '2026-08')).toBe('trip_t1__2026-08')
    expect(rollupEntryId('t1', '2026-08')).toBe(rollupEntryId('t1', '2026-08'))
    expect(rollupEntryId('t1', '2026-09')).not.toBe(rollupEntryId('t1', '2026-08'))
    expect(rollupEntryId('t2', '2026-08')).not.toBe(rollupEntryId('t1', '2026-08'))
  })
})

describe('totalsByMonth', () => {
  it('מסכם חודש אחד', () => {
    expect([...totalsByMonth([e('2026-08', 100), e('2026-08', 250)])]).toEqual([['2026-08', 350]])
  })

  it('מפצל טיול שחוצה חודשים', () => {
    const totals = totalsByMonth([
      e('2026-07', 2800),
      e('2026-08', 3200),
      e('2026-08', 1450),
    ])
    expect(totals.get('2026-07')).toBe(2800)
    expect(totals.get('2026-08')).toBe(4650)
    expect(totals.size).toBe(2)
  })

  it('מדלג על רשומה בלי חודש במקום ליצור מפתח ריק', () => {
    const totals = totalsByMonth([e(undefined, 500), e('2026-08', 100)])
    expect(totals.size).toBe(1)
    expect(totals.get('2026-08')).toBe(100)
  })

  it('סכום חסר נספר כאפס', () => {
    expect(totalsByMonth([e('2026-08', undefined)]).get('2026-08')).toBe(0)
  })
})

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

describe('summarizeGoal', () => {
  const dep = (actualAmount) => ({ category: 'deposit', actualAmount })
  const wd = (actualAmount) => ({ category: 'withdrawal', actualAmount })

  it('מצטבר לעבר היעד', async () => {
    const { summarizeGoal } = await import('../src/lib/model')
    const s = summarizeGoal([dep(4000), dep(2000)], 20000)
    expect(s.saved).toBe(6000)
    expect(s.remaining).toBe(14000)
    expect(s.progress).toBe(30)
    expect(s.reached).toBe(false)
  })

  it('משיכה מקטינה את הצבירה', async () => {
    const { summarizeGoal } = await import('../src/lib/model')
    const s = summarizeGoal([dep(5000), wd(1500)], 20000)
    expect(s.saved).toBe(3500)
    expect(s.totals.deposit).toBe(5000)
    expect(s.totals.withdrawal).toBe(1500)
  })

  it('מזהה הגעה ליעד, והפס נעצר ב-100', async () => {
    const { summarizeGoal } = await import('../src/lib/model')
    const s = summarizeGoal([dep(25000)], 20000)
    expect(s.reached).toBe(true)
    expect(s.progress).toBe(100)
    expect(s.remaining).toBe(-5000)
  })

  it('צבירה שלילית לא מפילה את הפס מתחת לאפס', async () => {
    const { summarizeGoal } = await import('../src/lib/model')
    const s = summarizeGoal([wd(500)], 20000)
    expect(s.saved).toBe(-500)
    expect(s.progress).toBe(0)
  })

  it('מטרה בלי יעד לא מתפוצצת', async () => {
    const { summarizeGoal } = await import('../src/lib/model')
    const s = summarizeGoal([dep(300)], 0)
    expect(s.progress).toBe(0)
    expect(s.reached).toBe(false)
  })
})

describe('שורה מסכמת לפי סוג', () => {
  it('טיול נכנס לשארית ומטרה לקרן', async () => {
    const { rollupName } = await import('../src/lib/trips')
    expect(rollupName({ type: 'trip', name: 'יוון' })).toBe('טיול: יוון')
    expect(rollupName({ type: 'goal', name: 'רכב' })).toBe('חיסכון: רכב')
  })

  it('משיכה מקטינה את מה שנזקף לחודש', async () => {
    const { totalsByMonth, goalSign } = await import('../src/lib/trips')
    const totals = totalsByMonth([
      { month: '2026-09', actualAmount: 3000, category: 'deposit' },
      { month: '2026-09', actualAmount: 800, category: 'withdrawal' },
    ], goalSign)
    expect(totals.get('2026-09')).toBe(2200)
  })
})

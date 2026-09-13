import { describe, expect, it } from 'vitest'
import { calcBaseAmount, monthKey, summarizeMonth } from '../src/lib/model'

const entry = (overrides) => ({
  category: 'fixed', budgetGroup: 'fixed', name: 'x',
  plannedAmount: 0, actualAmount: 0, month: '2026-09', ...overrides,
})

describe('calcBaseAmount', () => {
  it('הדוגמאות מהתוכנית', () => {
    expect(calcBaseAmount(24000)).toBe(20000)
    expect(calcBaseAmount(26000)).toBe(25000)
    expect(calcBaseAmount(25000)).toBe(20000) // כפולה מדויקת יורדת מדרגה
  })

  it('מתחת למדרגה הראשונה מחזיר אפס', () => {
    expect(calcBaseAmount(4999)).toBe(0)
    expect(calcBaseAmount(5000)).toBe(0)
    expect(calcBaseAmount(5001)).toBe(5000)
  })

  it('קלט לא תקין לא מפיל את החישוב', () => {
    expect(calcBaseAmount(0)).toBe(0)
    expect(calcBaseAmount(-100)).toBe(0)
    expect(calcBaseAmount(NaN)).toBe(0)
    expect(calcBaseAmount(undefined)).toBe(0)
  })
})

describe('summarizeMonth', () => {
  it('חודש ריק', () => {
    const summary = summarizeMonth([])
    expect(summary.totalIncome).toBe(0)
    expect(summary.baseAmount).toBe(0)
    expect(summary.unplanned.reserve).toBe(0)
    expect(summary.groups.fixed.target).toBe(0)
  })

  it('מחשב בסיס, יעדים ויתרות לפי 50/30/20', () => {
    const summary = summarizeMonth([
      entry({ category: 'income', budgetGroup: 'none', actualAmount: 14000 }),
      entry({ category: 'income', budgetGroup: 'none', actualAmount: 10000 }),
      entry({ category: 'fixed', budgetGroup: 'fixed', actualAmount: 6000 }),
      entry({ category: 'leisure', budgetGroup: 'leisure', actualAmount: 2000 }),
      entry({ category: 'fund', budgetGroup: 'savings', actualAmount: 4000 }),
    ])

    expect(summary.totalIncome).toBe(24000)
    expect(summary.baseAmount).toBe(20000)
    expect(summary.unplanned.reserve).toBe(4000)

    expect(summary.groups.fixed.target).toBe(10000)
    expect(summary.groups.fixed.remaining).toBe(4000)
    expect(summary.groups.leisure.target).toBe(6000)
    expect(summary.groups.savings.target).toBe(4000)
    expect(summary.groups.savings.remaining).toBe(0)

    expect(summary.totalExpenses).toBe(12000)
    expect(summary.balance).toBe(12000)
  })

  it('הפקדה לקרן מעל היעד היא חריגה חיובית תקינה', () => {
    const summary = summarizeMonth([
      entry({ category: 'income', budgetGroup: 'none', actualAmount: 24000 }),
      entry({ category: 'fund', budgetGroup: 'savings', actualAmount: 7000 }),
    ])
    expect(summary.groups.savings.target).toBe(4000)
    expect(summary.groups.savings.deviation).toBe(3000)
    expect(summary.groups.savings.remaining).toBe(-3000)
  })

  it('הכנסה אינה נספרת כהוצאה', () => {
    const summary = summarizeMonth([
      entry({ category: 'income', budgetGroup: 'none', actualAmount: 10000 }),
    ])
    expect(summary.totalExpenses).toBe(0)
    expect(summary.balance).toBe(10000)
  })

  it('שורות בלי actualAmount לא שוברות את הסכימה', () => {
    const summary = summarizeMonth([
      entry({ category: 'income', budgetGroup: 'none', actualAmount: 24000 }),
      entry({ category: 'fixed', budgetGroup: 'fixed', plannedAmount: 3000 }),
    ])
    expect(summary.totalExpenses).toBe(0)
    expect(summary.groups.fixed.planned).toBe(3000)
  })
})

describe('monthKey', () => {
  it('מרפד חודש חד-ספרתי', () => {
    expect(monthKey(new Date(2026, 8, 12))).toBe('2026-09')
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12')
  })
})

describe('shiftMonth', () => {
  it('זז קדימה ואחורה בתוך שנה', async () => {
    const { shiftMonth } = await import('../src/lib/model')
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-09', -1)).toBe('2026-08')
  })

  it('גולש נכון בין שנים', async () => {
    const { shiftMonth } = await import('../src/lib/model')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthLabel', () => {
  it('מציג שם חודש בעברית', async () => {
    const { monthLabel } = await import('../src/lib/format')
    expect(monthLabel('2026-09')).toBe('ספטמבר 2026')
    expect(monthLabel('2026-01')).toBe('ינואר 2026')
    expect(monthLabel('2026-12')).toBe('דצמבר 2026')
  })
})

describe('סימון חריגות', () => {
  it('עודף בחיסכון אינו חריגה, בקבועות ובפנאי כן', async () => {
    const { isOverageGood } = await import('../src/lib/model')
    expect(isOverageGood('savings')).toBe(true)
    expect(isOverageGood('fixed')).toBe(false)
    expect(isOverageGood('leisure')).toBe(false)
  })

  it('שורת הוצאה מסומנת רק כשחורגים מעל המתוכנן', async () => {
    const { isEntryConcerning } = await import('../src/lib/model')
    expect(isEntryConcerning({ category: 'fixed', plannedAmount: 1000, actualAmount: 1200 })).toBe(true)
    expect(isEntryConcerning({ category: 'fixed', plannedAmount: 1000, actualAmount: 800 })).toBe(false)
  })

  it('שורת הכנסה מסומנת כשמרוויחים פחות מהצפוי, לא יותר', async () => {
    const { isEntryConcerning } = await import('../src/lib/model')
    expect(isEntryConcerning({ category: 'income', plannedAmount: 8000, actualAmount: 10000 })).toBe(false)
    expect(isEntryConcerning({ category: 'income', plannedAmount: 8000, actualAmount: 6000 })).toBe(true)
  })

  it('הפקדה לקרן מעל התכנון לעולם אינה מסומנת', async () => {
    const { isEntryConcerning } = await import('../src/lib/model')
    expect(isEntryConcerning({ category: 'fund', plannedAmount: 4000, actualAmount: 9000 })).toBe(false)
  })

  it('בלי תכנון אין מה להשוות', async () => {
    const { isEntryConcerning } = await import('../src/lib/model')
    expect(isEntryConcerning({ category: 'fixed', plannedAmount: 0, actualAmount: 500 })).toBe(false)
  })
})

describe('recentMonths', () => {
  it('מחזיר חודשים רצופים שמסתיימים בחודש הנוכחי', async () => {
    const { recentMonths } = await import('../src/hooks/useHistory')
    const { monthKey } = await import('../src/lib/model')
    const months = recentMonths(6)
    expect(months).toHaveLength(6)
    expect(months.at(-1)).toBe(monthKey())
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i] > months[i - 1]).toBe(true)
    }
  })
})

describe('בלתם כקטגוריה אמיתית', () => {
  const withIncome = (extra = []) => summarizeMonth([
    entry({ category: 'income', budgetGroup: 'none', actualAmount: 24000 }),
    ...extra,
  ])

  it('הרזרבה היא ההכנסה פחות הבסיס', () => {
    const summary = withIncome()
    expect(summary.unplanned).toMatchObject({ reserve: 4000, spent: 0, remaining: 4000 })
  })

  it('הוצאה מהרזרבה מקטינה אותה', () => {
    const summary = withIncome([
      entry({ category: 'unplanned', budgetGroup: 'none', actualAmount: 1500 }),
    ])
    expect(summary.unplanned).toMatchObject({ reserve: 4000, spent: 1500, remaining: 2500 })
  })

  it('אפשר לחרוג מהרזרבה, וזה מסומן כשלילי', () => {
    const summary = withIncome([
      entry({ category: 'unplanned', budgetGroup: 'none', actualAmount: 5200 }),
    ])
    expect(summary.unplanned.remaining).toBe(-1200)
  })

  it('הוצאה מהרזרבה נספרת בהוצאות ומקטינה את היתרה', () => {
    const summary = withIncome([
      entry({ category: 'unplanned', budgetGroup: 'none', actualAmount: 1500 }),
    ])
    expect(summary.totalExpenses).toBe(1500)
    expect(summary.balance).toBe(22500)
  })

  it('אינה משפיעה על יעדי 50/30/20', () => {
    const summary = withIncome([
      entry({ category: 'unplanned', budgetGroup: 'none', actualAmount: 3000 }),
    ])
    expect(summary.groups.fixed.target).toBe(10000)
    expect(summary.groups.fixed.actual).toBe(0)
    expect(summary.groups.leisure.actual).toBe(0)
    expect(summary.groups.savings.actual).toBe(0)
  })
})

describe('סוג תקציב', () => {
  it('תקציב ישן בלי שדה type הוא משק בית', async () => {
    const { budgetType, isTrip } = await import('../src/lib/model')
    expect(budgetType({ name: 'ישן' })).toBe('household')
    expect(budgetType(undefined)).toBe('household')
    expect(isTrip({ type: 'trip' })).toBe(true)
    expect(isTrip({ type: 'household' })).toBe(false)
  })
})

describe('summarizeTrip', () => {
  const tripEntry = (category, actualAmount) => ({ category, actualAmount })

  it('מסגרת פחות מה שהוצא', async () => {
    const { summarizeTrip } = await import('../src/lib/model')
    const summary = summarizeTrip([
      tripEntry('lodging', 4000),
      tripEntry('dining', 1200),
      tripEntry('attractions', 800),
    ], 12000)

    expect(summary.spent).toBe(6000)
    expect(summary.remaining).toBe(6000)
    expect(summary.progress).toBe(50)
    expect(summary.totals.lodging).toBe(4000)
  })

  it('חריגה מהמסגרת היא שלילית, והפס נעצר ב-100', async () => {
    const { summarizeTrip } = await import('../src/lib/model')
    const summary = summarizeTrip([tripEntry('lodging', 15000)], 12000)
    expect(summary.remaining).toBe(-3000)
    expect(summary.progress).toBe(100)
  })

  it('קטגוריה לא מוכרת נופלת ל"אחר" ולא נעלמת', async () => {
    const { summarizeTrip } = await import('../src/lib/model')
    const summary = summarizeTrip([tripEntry('משהו', 500)], 1000)
    expect(summary.totals.other).toBe(500)
    expect(summary.spent).toBe(500)
  })

  it('טיול בלי מסגרת לא מתפוצץ', async () => {
    const { summarizeTrip } = await import('../src/lib/model')
    const summary = summarizeTrip([tripEntry('dining', 300)], 0)
    expect(summary.progress).toBe(0)
    expect(summary.remaining).toBe(-300)
  })
})

describe('תאריך רשומה', () => {
  it('גוזר חודש מתאריך', async () => {
    const { monthOfDate } = await import('../src/lib/model')
    expect(monthOfDate('2026-12-31')).toBe('2026-12')
    expect(monthOfDate('2027-01-02')).toBe('2027-01')
    expect(monthOfDate(undefined)).toBe('')
  })

  it('תאריך היום מרופד נכון', async () => {
    const { todayDate } = await import('../src/lib/model')
    expect(todayDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayDate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

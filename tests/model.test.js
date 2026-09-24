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

describe('שארית כקטגוריה אמיתית', () => {
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

describe('השלמת מסמך החבר', () => {
  const MAIL = 'd@mail.com'

  it('מזהה שם חסר או שונה', async () => {
    const { needsMemberSync } = await import('../src/lib/members')
    expect(needsMemberSync({ uid: 'u1' }, 'דניאל', MAIL)).toBe(true)
    expect(needsMemberSync({ uid: 'u1', displayName: '' }, 'דניאל', MAIL)).toBe(true)
    expect(needsMemberSync({ uid: 'u1', displayName: 'ישן' }, 'דניאל', MAIL)).toBe(true)
  })

  it('מזהה מייל חסר גם כששם כבר נכון', async () => {
    const { needsMemberSync } = await import('../src/lib/members')
    // זה היה הבאג: ההשלמה דילגה על מי ששמו נכון, ולכן המייל לא נכתב
    expect(needsMemberSync({ uid: 'u1', displayName: 'דניאל' }, 'דניאל', MAIL)).toBe(true)
  })

  it('לא נוגע כששניהם נכונים, כדי לא לכתוב בכל טעינה', async () => {
    const { needsMemberSync } = await import('../src/lib/members')
    expect(needsMemberSync({ uid: 'u1', displayName: 'דניאל', email: MAIL }, 'דניאל', MAIL))
      .toBe(false)
  })

  it('בלי שם ובלי מייל להשלים מהם, לא עושה כלום', async () => {
    const { needsMemberSync } = await import('../src/lib/members')
    expect(needsMemberSync({ uid: 'u1' }, '', '')).toBe(false)
    expect(needsMemberSync(null, 'דניאל', MAIL)).toBe(false)
  })
})

describe('זיהוי סוג התקציב', () => {
  it('מזהה את כל הסוגים, ולא רק את הראשון שנוסף', async () => {
    const { budgetType, isTrip, isGoal, isFrameBudget } = await import('../src/lib/model')
    expect(budgetType({ type: 'household' })).toBe('household')
    expect(budgetType({ type: 'trip' })).toBe('trip')
    expect(budgetType({ type: 'goal' })).toBe('goal')
    expect(isGoal({ type: 'goal' })).toBe(true)
    expect(isTrip({ type: 'goal' })).toBe(false)
    expect(isFrameBudget({ type: 'goal' })).toBe(true)
    expect(isFrameBudget({ type: 'household' })).toBe(false)
  })

  it('סוג לא מוכר או חסר נקרא כמשק בית', async () => {
    const { budgetType } = await import('../src/lib/model')
    expect(budgetType({})).toBe('household')
    expect(budgetType({ type: 'משהו' })).toBe('household')
    expect(budgetType(undefined)).toBe('household')
  })
})

describe('מועד חיוב', () => {
  it('שלושת התאריכים שחברות האשראי מציעות', async () => {
    const { BILLING_DAYS, DEFAULT_BILLING_DAY } = await import('../src/lib/model')
    expect(BILLING_DAYS).toEqual([2, 10, 15])
    expect(BILLING_DAYS).toContain(DEFAULT_BILLING_DAY)
  })

  it('כל יום שקיים בכל חודש תקין, ומעבר לכך לא', async () => {
    const { isBillingDay } = await import('../src/lib/model')
    expect(isBillingDay(2)).toBe(true)
    expect(isBillingDay(28)).toBe(true)
    expect(isBillingDay(20)).toBe(true)
    // 29 עד 31 לא קיימים בכל חודש, וחיוב שנופל עליהם היה נודד
    expect(isBillingDay(29)).toBe(false)
    expect(isBillingDay(0)).toBe(false)
    expect(isBillingDay(10.5)).toBe(false)
    expect(isBillingDay('10')).toBe(false)
  })
})

describe('חלון החיוב', () => {
  it('מיום החיוב בחודש ועד אותו יום בחודש הבא', async () => {
    const { billingWindow } = await import('../src/lib/model')
    expect(billingWindow('2026-09', 10)).toBe('10.9 עד 10.10')
    expect(billingWindow('2026-09', 2)).toBe('2.9 עד 2.10')
    expect(billingWindow('2026-09', 15)).toBe('15.9 עד 15.10')
  })

  it('דצמבר ממשיך לינואר', async () => {
    const { billingWindow } = await import('../src/lib/model')
    expect(billingWindow('2026-12', 10)).toBe('10.12 עד 10.1')
  })

  it('בלי יום חיוב אין חלון, וגם לא נופל', async () => {
    const { billingWindow } = await import('../src/lib/model')
    expect(billingWindow('2026-09', undefined)).toBe('')
    expect(billingWindow('2026-09', 31)).toBe('')
    expect(billingWindow('', 10)).toBe('')
  })
})

describe('סכום בסיס שנקבע מראש', () => {
  const income = (actualAmount) => ({
    category: 'income', budgetGroup: 'none', actualAmount, plannedAmount: 0,
  })

  it('בלי בסיס קבוע ממשיכים לגזור מההכנסה', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(31000)])
    expect(s.baseAmount).toBe(30000)
    expect(s.usesFixedBase).toBe(false)
  })

  it('בסיס קבוע לא זז כשחודש טוב במיוחד', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(31000)], { fixedBase: 20000 })
    expect(s.baseAmount).toBe(20000)
    expect(s.usesFixedBase).toBe(true)
    // וזו כל הנקודה: היעדים נגזרים מהתוכנית ולא מהחודש
    expect(s.groups.fixed.target).toBe(10000)
    expect(s.groups.leisure.target).toBe(6000)
    expect(s.groups.savings.target).toBe(4000)
  })

  it('מה שמעבר לבסיס הוא השארית', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    expect(summarizeMonth([income(31000)], { fixedBase: 20000 }).unplanned.reserve).toBe(11000)
  })

  it('חודש רזה לא ממציא כסף שלא נכנס', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(14000)], { fixedBase: 20000 })
    expect(s.baseAmount).toBe(14000)
    expect(s.unplanned.reserve).toBe(0)
    expect(s.baseShortfall).toBe(6000)
  })

  it('אפס מחזיר לגזירה אוטומטית', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(31000)], { fixedBase: 0 })
    expect(s.baseAmount).toBe(30000)
    expect(s.usesFixedBase).toBe(false)
  })
})

describe('חריגה מההכנסות', () => {
  const summary = (totalIncome, totalExpenses) => ({ totalIncome, totalExpenses })

  it('בתוך ההכנסות אין התראה', async () => {
    const { incomeOverage } = await import('../src/lib/model')
    expect(incomeOverage(summary(20000, 15000), 1000)).toBeNull()
  })

  it('מזהה את ההוצאה שחוצה את הקו', async () => {
    const { incomeOverage } = await import('../src/lib/model')
    const result = incomeOverage(summary(20000, 19500), 1000)
    expect(result.gap).toBe(500)
    expect(result.crossing).toBe(true)
  })

  it('מבדיל בין חציית הקו לבין מצב שכבר חורג', async () => {
    const { incomeOverage } = await import('../src/lib/model')
    const result = incomeOverage(summary(20000, 21000), 500)
    expect(result.gap).toBe(1500)
    expect(result.crossing).toBe(false)
  })

  it('לפני שהוזנה הכנסה אין התראה, אחרת כל תחילת חודש הייתה רועשת', async () => {
    const { incomeOverage } = await import('../src/lib/model')
    expect(incomeOverage(summary(0, 3000), 500)).toBeNull()
  })
})

describe('היכן חרגנו', () => {
  const withGroups = (groups) => ({ groups })

  it('מחזיר רק קבוצות שחרגו, מהגדולה לקטנה', async () => {
    const { overspentGroups } = await import('../src/lib/model')
    const result = overspentGroups(withGroups({
      fixed: { target: 10000, deviation: 500 },
      leisure: { target: 6000, deviation: 1800 },
      savings: { target: 4000, deviation: -200 },
    }))
    expect(result.map((item) => item.group)).toEqual(['leisure', 'fixed'])
    expect(result[0].over).toBe(1800)
  })

  it('חריגה בקרן היא דבר טוב ולכן אינה נספרת כחריגה', async () => {
    const { overspentGroups } = await import('../src/lib/model')
    expect(overspentGroups(withGroups({
      savings: { target: 4000, deviation: 1000 },
    }))).toEqual([])
  })

  it('קבוצה בלי יעד לא נספרת', async () => {
    const { overspentGroups } = await import('../src/lib/model')
    expect(overspentGroups(withGroups({ fixed: { target: 0, deviation: 900 } }))).toEqual([])
  })
})

describe('המחזור שרץ עכשיו', () => {
  const at = (iso) => new Date(iso)

  it('לפני מועד החיוב עדיין מסיימים את החודש הקודם', async () => {
    const { activeMonth } = await import('../src/lib/model')
    expect(activeMonth(10, at('2026-10-05T09:00:00'))).toBe('2026-09')
    expect(activeMonth(10, at('2026-10-12T09:00:00'))).toBe('2026-10')
    expect(activeMonth(10, at('2026-10-10T09:00:00'))).toBe('2026-10')
  })

  it('בלי מועד חיוב מתנהג לפי הלוח', async () => {
    const { activeMonth } = await import('../src/lib/model')
    expect(activeMonth(undefined, at('2026-10-05T09:00:00'))).toBe('2026-10')
  })

  it('מחזור נסגר במועד החיוב של החודש שאחריו', async () => {
    const { isMonthClosed } = await import('../src/lib/model')
    expect(isMonthClosed('2026-09', 10, at('2026-10-05T09:00:00'))).toBe(false)
    expect(isMonthClosed('2026-09', 10, at('2026-10-10T09:00:00'))).toBe(true)
  })
})

describe('הפקדה מהיתרה', () => {
  const income = (actualAmount) => ({ category: 'income', budgetGroup: 'none', actualAmount })
  const unplanned = (actualAmount) => ({ category: 'unplanned', budgetGroup: 'none', actualAmount })
  const deposit = (actualAmount, fromRemainder = false) => ({
    category: 'fund', budgetGroup: 'savings', actualAmount, fromRemainder,
  })

  it('הפקדה רגילה לא נוגעת ביתרה', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(22500), deposit(4000)], { fixedBase: 20000 })
    expect(s.unplanned.reserve).toBe(2500)
    expect(s.unplanned.remaining).toBe(2500)
  })

  it('הפקדה מהיתרה מקטינה אותה, אחרת אותו כסף היה מוצע להפקדה שוב', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(22500), deposit(2500, true)], { fixedBase: 20000 })
    expect(s.unplanned.remaining).toBe(0)
    expect(s.unplanned.deposited).toBe(2500)
  })

  it('בלת״ם והפקדה מהיתרה מצטברים יחד', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth(
      [income(22500), unplanned(510), deposit(1000, true)],
      { fixedBase: 20000 },
    )
    expect(s.unplanned.spent).toBe(1510)
    expect(s.unplanned.remaining).toBe(990)
  })

  it('ההפקדה עדיין נספרת בהפקדות, כי היא באמת הופקדה', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(22500), deposit(2500, true)], { fixedBase: 20000 })
    expect(s.groups.savings.actual).toBe(2500)
  })
})

describe('פרופיל: שם וגוון', () => {
  it('הפרופיל גובר על השם שבמסמך החבר', async () => {
    const { displayName } = await import('../src/lib/members')
    const member = { uid: 'u1', displayName: 'דניאל' }
    expect(displayName(member)).toBe('דניאל')
    expect(displayName(member, { displayName: 'דני' })).toBe('דני')
  })

  it('בלי פרופיל ממשיכים בדיוק כמו קודם', async () => {
    const { displayName } = await import('../src/lib/members')
    expect(displayName({ uid: 'u1', email: 'noa@mail.com' })).toBe('noa')
    expect(displayName(null)).toBe('שותף')
  })

  it('הגוון שייך לאדם ולא למקום ברשימה', async () => {
    const { avatarTone } = await import('../src/lib/members')
    const member = { uid: 'u1' }
    // אותו אדם, אותו גוון, בלי קשר לאן הוא ממוין
    expect(avatarTone(member)).toBe(avatarTone(member))
    expect(avatarTone(member, { tone: 'a5' })).toBe('a5')
  })

  it('שני אנשים שונים מקבלים ברירות מחדל שונות', async () => {
    const { defaultTone } = await import('../src/lib/profile')
    const tones = new Set(['abc', 'def', 'ghi', 'jkl'].map(defaultTone))
    expect(tones.size).toBeGreaterThan(1)
  })
})

describe('תווית חבר לרשימה', () => {
  it('מייל כשיש, ואחרת השם', async () => {
    const { memberLabel } = await import('../src/lib/budgets')
    expect(memberLabel({ email: 'd@mail.com', displayName: 'דניאל' })).toBe('d@mail.com')
    expect(memberLabel({ displayName: 'דניאל', uid: 'u1' })).toBe('דניאל')
    expect(memberLabel({ uid: 'u1' })).toBe('u1')
    expect(memberLabel(null)).toBe('')
  })
})

describe('זיכוי כהוצאה שקוזזה', () => {
  const income = (actualAmount) => ({ category: 'income', budgetGroup: 'none', actualAmount })
  const spend = (actualAmount) => ({ category: 'fixed', budgetGroup: 'fixed', actualAmount })

  it('מקטין את הקטגוריה שבה הוא היה', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const s = summarizeMonth([income(20000), spend(5000), spend(-300)], { fixedBase: 20000 })
    expect(s.groups.fixed.actual).toBe(4700)
    expect(s.totalExpenses).toBe(4700)
  })

  it('מגדיל את היתרה, כי פחות כסף באמת יצא', async () => {
    const { summarizeMonth } = await import('../src/lib/model')
    const withRefund = summarizeMonth([income(20000), spend(5000), spend(-300)])
    const without = summarizeMonth([income(20000), spend(5000)])
    expect(withRefund.balance - without.balance).toBe(300)
  })

  it('קטגוריה שירדה מתחת לאפס אינה מייצרת פס בעל רוחב שלילי', async () => {
    const { summarizeMonth, groupTarget } = await import('../src/lib/model')
    const s = summarizeMonth([income(20000), spend(100), spend(-500)], { fixedBase: 20000 })
    expect(s.groups.fixed.actual).toBe(-400)
    const progress = Math.max(0, Math.min(100, (s.groups.fixed.actual / groupTarget(20000, 'fixed')) * 100))
    expect(progress).toBe(0)
  })
})


describe('ציר החיובים עם קצב שאינו חודשי', () => {
  it('חיוב דו חודשי לא מופיע בחודש שבו אינו יורד', async () => {
    const { buildTimeline } = await import('../src/lib/upcoming')
    const arnona = {
      id: 'arnona', name: 'ארנונה', active: true, category: 'fixed',
      offCard: true, dueDay: 10, actualAmount: 1300,
      startMonth: '2025-01', everyMonths: 2,
    }
    // מרץ הוא חודש שבו היא יורדת, אפריל אינו
    const inMarch = buildTimeline({ templates: [arnona], today: new Date(2025, 2, 1) })
    const inApril = buildTimeline({ templates: [arnona], today: new Date(2025, 3, 1) })
    expect(inMarch.map((event) => event.name)).toEqual(['ארנונה'])
    expect(inApril).toEqual([])
  })
})

describe('חיוב שנגמר לא מופיע בציר', () => {
  /**
   * הקצב והסיום הם שני דברים: תבנית חודשית עוברת את בדיקת הקצב
   * תמיד, ובלי בדיקת סיום נפרדת היא נשארת על הציר לנצח.
   */
  it('הלוואה שנגמרה אינה עומדת לרדת', async () => {
    const { buildTimeline } = await import('../src/lib/upcoming')
    const loan = {
      id: 'loan', name: 'הלוואה', active: true, category: 'fixed',
      offCard: true, dueDay: 10, actualAmount: 1100,
      startMonth: '2025-01', endMonth: '2026-08',
    }
    const before = buildTimeline({ templates: [loan], today: new Date(2026, 7, 1) })
    const after = buildTimeline({ templates: [loan], today: new Date(2026, 8, 1) })
    expect(before.map((event) => event.name)).toEqual(['הלוואה'])
    expect(after).toEqual([])
  })
})

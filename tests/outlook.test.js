import { describe, expect, it } from 'vitest'
import { monthOutlook, planRemaining, planSpent } from '../src/lib/model'

// תקציב של 20,000 בסיס, שתי קבוצות בשימוש, ושני חברים
const build = ({ income = 24600, fixed = 8000, leisure = 5000, savings = 0, base = 20000 } = {}) => ({
  totalIncome: income,
  totalExpenses: fixed + leisure + savings,
  baseAmount: base,
  groups: {
    fixed: { actual: fixed, target: 10000, deviation: fixed - 10000 },
    leisure: { actual: leisure, target: 6000, deviation: leisure - 6000 },
    savings: { actual: savings, target: 4000, deviation: savings - 4000 },
  },
})

const two = { incomeCount: 2, memberCount: 2 }

describe('planSpent ו-planRemaining', () => {
  it('סופרים את שלוש הקבוצות בלבד', () => {
    expect(planSpent(build())).toBe(13000)
    expect(planRemaining(build())).toBe(7000)
  })

  it('לא קורסים בלי נתונים', () => {
    expect(planSpent(null)).toBe(0)
    expect(planRemaining(undefined)).toBe(0)
  })
})

describe('monthOutlook', () => {
  it('שותק כשהחודש בתוך התוכנית', () => {
    expect(monthOutlook(build(), two)).toBeNull()
  })

  it('מזהה שבירה של התוכנית כשההכנסה עדיין מכסה', () => {
    const outlook = monthOutlook(build({ fixed: 12000, leisure: 9000 }), two)
    expect(outlook).toMatchObject({ level: 'plan', gap: 1000 })
  })

  it('מזהה חריגה מההכנסה כסף חמור יותר', () => {
    const outlook = monthOutlook(build({ fixed: 15000, leisure: 11000 }), two)
    expect(outlook).toMatchObject({ level: 'income', gap: 1400 })
  })

  it('מצרף את הקבוצה שחרגה הכי הרבה', () => {
    const outlook = monthOutlook(build({ fixed: 12000, leisure: 9000 }), two)
    expect(outlook.worst.group).toBe('leisure')
  })

  it('שותק בלי הכנסה בכלל', () => {
    expect(monthOutlook(build({ income: 0, fixed: 9000 }), two)).toBeNull()
  })

  // זו ההגנה מפני אזהרת שווא: עד שהוזנה הכנסה לכל חבר, הצד הזה חלקי
  it('שותק בתקציב של שניים כשהוזנה משכורת אחת', () => {
    const broken = build({ income: 12000, fixed: 15000, leisure: 11000 })
    expect(monthOutlook(broken, { incomeCount: 1, memberCount: 2 })).toBeNull()
  })

  it('מתריע באותו חודש ברגע שהוזנה גם השנייה', () => {
    const broken = build({ income: 12000, fixed: 15000, leisure: 11000 })
    expect(monthOutlook(broken, { incomeCount: 2, memberCount: 2 })).toMatchObject({ level: 'income' })
  })

  it('בתקציב של אחד מספיקה הכנסה אחת', () => {
    const broken = build({ income: 12000, fixed: 15000, leisure: 11000 })
    expect(monthOutlook(broken, { incomeCount: 1, memberCount: 1 })).toMatchObject({ level: 'income' })
  })

  it('שותק כשאין בסיס, כי אין תוכנית לשבור', () => {
    expect(monthOutlook(build({ base: 0, fixed: 8000, leisure: 6000 }), two)).toBeNull()
  })
})

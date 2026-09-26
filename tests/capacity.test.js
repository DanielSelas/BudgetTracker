import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/firebase', () => ({ db: {} }))

const {
  buildCapacity, commitmentsFor, futureInstallments, incomeFloor, median,
  planFor, typicalVariable, variableOf,
} = await import('../src/lib/capacity')

/**
 * "כמה פנוי לי" נבנה ממה שידוע בוודאות ולא מתחזית. ההיסטוריה
 * משמשת רק לשאלה אחת: כמה עולה חודש רגיל. וגם שם, חציון ולא ממוצע,
 * כי ממוצע נגרר אחרי החודש החריג שאותו רוצים להוציא.
 */
const entry = (month, category, actualAmount, extra = {}) =>
  ({ month, category, actualAmount, ...extra })

describe('הוצאה משתנה של חודש', () => {
  it('מחשבת מה שאינו הכנסה', () => {
    expect(variableOf([
      entry('2026-09', 'income', 20000),
      entry('2026-09', 'fixed', 800),
      entry('2026-09', 'leisure', 400),
    ])).toBe(1200)
  })

  it('לא סופרת שורה שנגזרה מחיוב קבוע, כי היא כבר נספרה כהתחייבות', () => {
    expect(variableOf([
      entry('2026-09', 'fixed', 5800, { recurringId: 'fixed-שכר-דירה' }),
      entry('2026-09', 'fixed', 800),
    ])).toBe(800)
  })

  it('ולא סופרת מה שסומן כחד פעמי', () => {
    expect(variableOf([
      entry('2026-09', 'unplanned', 11178, { oneOff: true }),
      entry('2026-09', 'leisure', 400),
    ])).toBe(400)
  })
})

describe('כמה עולה חודש רגיל', () => {
  const history = [
    entry('2025-08', 'leisure', 2000),
    entry('2025-08', 'unplanned', 11178, { oneOff: true }),
    entry('2025-09', 'leisure', 2400),
    entry('2025-10', 'leisure', 3000),
  ]

  /**
   * זה בדיוק המקרה של אוגוסט 2025: ניתוח לכלבה הפך אותו ליקר פי
   * עשרה. בלי הסימון החודש הטיפוסי היה קופץ מ-2,400 ל-5,526.
   */
  it('החד פעמי אינו מזיז את החודש הטיפוסי', () => {
    expect(typicalVariable(history, { now: '2025-11' }).amount).toBe(2400)
  })

  it('החודש הנוכחי אינו נספר, כי הוא עוד לא נגמר', () => {
    const withCurrent = [...history, entry('2025-11', 'leisure', 50)]
    expect(typicalVariable(withCurrent, { now: '2025-11' }).amount).toBe(2400)
  })

  it('חודש בלי הוצאות הוא חודש שלא הוזן ולא חודש זול', () => {
    const withEmpty = [...history, entry('2025-07', 'income', 20000)]
    expect(typicalVariable(withEmpty, { now: '2025-11' })).toEqual({ amount: 2400, months: 3 })
  })

  it('חציון של מספר זוגי של חודשים הוא האמצע בין השניים', () => {
    expect(median([1000, 2000, 3000, 6000])).toBe(2500)
    expect(median([])).toBe(0)
  })
})

describe('רצפת ההכנסה', () => {
  const history = [
    entry('2025-08', 'income', 22000),
    entry('2025-09', 'income', 18000),
    entry('2025-10', 'income', 25000),
  ]

  /**
   * שתי משכורות משתנות, ולכן תכנון לפי הממוצע מבטיח מה שלא בהכרח
   * יגיע. הנמוך ביותר הופך חודש טוב להפתעה לטובה.
   */
  it('בלי תבנית, הרצפה היא החודש הנמוך ביותר', () => {
    expect(incomeFloor(history, [], '2025-11', { now: '2025-11' }))
      .toEqual({ amount: 18000, source: 'lowest' })
  })

  /**
   * שתי משכורות: אחת עם בסיס קבוע ואחת משתנה לגמרי. הן מתחברות
   * ולא מחליפות זו את זו. הגרסה הראשונה החזירה את התבנית במקום
   * ההכנסה שנצפתה, כלומר הגדרת הבסיס של בן הייתה מוחקת את
   * המשכורת של דניאל מהחישוב ומורידה את הרצפה במקום לחדד אותה.
   */
  it('בסיס קבוע מתחבר לחלק המשתנה, ולא מחליף אותו', () => {
    const templates = [{
      id: 'ben', active: true, category: 'income', actualAmount: 10000, startMonth: '2025-01',
    }]
    // ההיסטוריה כאן היא המשכורת המשתנה בלבד, שלא נגזרה מתבנית
    expect(incomeFloor(history, templates, '2025-11', { now: '2025-11' }))
      .toEqual({ amount: 28000, source: 'mixed' })
  })

  it('שורה שנגזרה מהתבנית אינה נספרת פעמיים', () => {
    const templates = [{
      id: 'ben', active: true, category: 'income', actualAmount: 10000, startMonth: '2025-01',
    }]
    const withMaterialized = [
      ...history,
      entry('2025-09', 'income', 10000, { recurringId: 'ben' }),
    ]
    // 18,000 הוא עדיין החודש הנמוך של החלק המשתנה
    expect(incomeFloor(withMaterialized, templates, '2025-11', { now: '2025-11' }).amount)
      .toBe(28000)
  })

  it('תבנית בלבד, בלי היסטוריה משתנה', () => {
    const templates = [{
      id: 'ben', active: true, category: 'income', actualAmount: 10000, startMonth: '2025-01',
    }]
    expect(incomeFloor([], templates, '2025-11', { now: '2025-11' }))
      .toEqual({ amount: 10000, source: 'recurring' })
  })

  it('בלי שום נתון מחזירה אפס ואומרת זאת', () => {
    expect(incomeFloor([], [], '2025-11')).toEqual({ amount: 0, source: 'none' })
  })
})

describe('התחייבויות קדימה', () => {
  const rent = {
    id: 'rent', name: 'שכר דירה', active: true, category: 'fixed',
    actualAmount: 5800, startMonth: '2026-01',
  }
  const loan = {
    id: 'loan', name: 'הלוואה', active: true, category: 'fixed',
    actualAmount: 1100, startMonth: '2026-01', endMonth: '2026-12',
  }
  const arnona = {
    id: 'arnona', name: 'ארנונה', active: true, category: 'fixed',
    actualAmount: 1300, startMonth: '2026-01', everyMonths: 2,
  }

  it('רק מה שחל בחודש הזה נספר', () => {
    expect(commitmentsFor([rent, loan, arnona], '2026-01').amount).toBe(8200)
    // בפברואר הארנונה אינה יורדת
    expect(commitmentsFor([rent, loan, arnona], '2026-02').amount).toBe(6900)
  })

  it('התחייבות שנגמרה יוצאת מהחשבון', () => {
    expect(commitmentsFor([rent, loan], '2027-01').amount).toBe(5800)
  })

  it('הכנסה אינה התחייבות', () => {
    const salary = { id: 's', active: true, category: 'income', actualAmount: 20000, startMonth: '2026-01' }
    expect(commitmentsFor([rent, salary], '2026-01').amount).toBe(5800)
  })
})

describe('תשלומים שעוד לפנינו', () => {
  it('נגזרים מההערה שנשמרה על הרשומה', () => {
    const rows = [entry('2026-09', 'leisure', 300, { name: 'רהיטים', note: 'תשלום 1 מתוך 3' })]
    expect([...futureInstallments(rows)]).toEqual([['2026-10', 300], ['2026-11', 300]])
  })

  it('אותה עסקה בכמה חודשים נספרת לפי המתקדם ביותר', () => {
    const rows = [
      entry('2026-08', 'leisure', 300, { name: 'רהיטים', note: 'תשלום 1 מתוך 3' }),
      entry('2026-09', 'leisure', 300, { name: 'רהיטים', note: 'תשלום 2 מתוך 3' }),
    ]
    expect([...futureInstallments(rows)]).toEqual([['2026-10', 300]])
  })

  it('תשלום אחרון אינו מוסיף כלום', () => {
    const rows = [entry('2026-09', 'leisure', 300, { name: 'רהיטים', note: 'תשלום 3 מתוך 3' })]
    expect([...futureInstallments(rows)]).toEqual([])
  })
})

describe('הקו קדימה', () => {
  const templates = [
    { id: 'salary', name: 'משכורת', active: true, category: 'income', actualAmount: 20000, startMonth: '2026-01' },
    { id: 'rent', name: 'שכר דירה', active: true, category: 'fixed', actualAmount: 5800, startMonth: '2026-01' },
    { id: 'loan', name: 'הלוואה', active: true, category: 'fixed', actualAmount: 1100, startMonth: '2026-01', endMonth: '2026-10' },
  ]
  const history = [
    entry('2026-07', 'leisure', 2400),
    entry('2026-08', 'leisure', 2400),
  ]
  const { line, typical } = buildCapacity({
    entries: history, templates, now: '2026-09', months: 4,
  })

  it('המרווח הוא הכנסה פחות התחייבויות', () => {
    expect(line[0]).toMatchObject({ month: '2026-09', income: 20000, commitments: 6900, free: 13100 })
  })

  it('ומה שפנוי הוא אחרי חודש רגיל', () => {
    expect(typical.amount).toBe(2400)
    expect(line[0].available).toBe(10700)
  })

  /**
   * זו כל הסיבה שזה קו ולא מספר: ההתחייבויות נגמרות בתאריכים
   * ידועים, והמרווח קופץ.
   */
  it('כשהלוואה נגמרת, החודשים שאחריה גבוהים יותר', () => {
    expect(line[1]).toMatchObject({ month: '2026-10', commitments: 6900, free: 13100 })
    expect(line[2]).toMatchObject({ month: '2026-11', commitments: 5800, free: 14200 })
    expect(line[1].ending).toEqual(['הלוואה'])
  })
})

describe('תוכנית לסכום', () => {
  const line = [
    { month: '2026-09', available: 5000 },
    { month: '2026-10', available: 5000 },
    { month: '2026-11', available: 5000 },
    { month: '2026-12', available: 5000 },
  ]

  it('אומרת מתי הסכום מצטבר', () => {
    expect(planFor(line, 12000).readyAt).toBe('2026-11')
  })

  it('ומה חסר ליעד מוקדם יותר', () => {
    const plan = planFor(line, 12000, '2026-10')
    expect(plan.reachesTarget).toBe(false)
    expect(plan.shortfall).toBe(2000)
    expect(plan.perMonth).toBe(6000)
  })

  it('יעד שאפשר לעמוד בו מסומן ככזה', () => {
    expect(planFor(line, 8000, '2026-10').reachesTarget).toBe(true)
  })

  it('סכום ריק אינו תוכנית', () => {
    expect(planFor(line, 0)).toBe(null)
  })
})

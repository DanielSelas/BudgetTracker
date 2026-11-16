import { describe, expect, it } from 'vitest'
import { OTHER, chosenSpending, headlineSector, monthBreakdown, sectorColor } from '../src/lib/breakdown'
import { SECTOR_RULES } from '../src/lib/merchants'

const entry = (over = {}) => ({
  category: 'leisure', name: 'משהו', actualAmount: 100, ...over,
})

describe('chosenSpending', () => {
  it('מוציא חיוב שנולד מתבנית', () => {
    const rows = [entry({ name: 'שכר דירה', recurringId: 'r1' }), entry({ name: 'ארומה' })]
    expect(chosenSpending(rows)).toHaveLength(1)
    expect(chosenSpending(rows)[0].name).toBe('ארומה')
  })

  it('מוציא הכנסה, הפקדה וקבועות, ומשאיר בלת״ם', () => {
    const rows = [
      entry({ category: 'income', name: 'משכורת' }),
      entry({ category: 'fund', name: 'קרן' }),
      entry({ category: 'fixed', name: 'ביטוח' }),
      entry({ category: 'unplanned', name: 'תיקון רכב' }),
    ]
    expect(chosenSpending(rows).map((row) => row.category)).toEqual(['unplanned'])
  })

  it('מוציא קבועה שהוקלדה ביד, גם בלי תבנית', () => {
    const rows = [entry({ category: 'fixed', name: 'ארנונה', recurringId: null })]
    expect(chosenSpending(rows)).toHaveLength(0)
  })

  it('מתעלם מסכום אפס', () => {
    expect(chosenSpending([entry({ actualAmount: 0 })])).toHaveLength(0)
  })
})

describe('monthBreakdown', () => {
  it('מאחד שמות שונים לאותו ענף', () => {
    const { slices, total } = monthBreakdown([
      entry({ name: 'ארומה תל אביב', actualAmount: 60 }),
      entry({ name: 'קפה לנדוור', actualAmount: 40 }),
      entry({ name: 'זארה', actualAmount: 300 }),
    ])
    expect(total).toBe(400)
    expect(slices[0]).toMatchObject({ sector: 'ביגוד והנעלה', amount: 300 })
    expect(slices[1]).toMatchObject({ sector: 'מסעדות ובתי קפה', amount: 100 })
  })

  it('תופס גם שם שהוקלד ביד, כי ההתאמה היא הכלה', () => {
    const { slices } = monthBreakdown([entry({ name: 'מסעדות ובילויים', actualAmount: 500 })])
    expect(slices[0].sector).toBe('מסעדות ובתי קפה')
  })

  it('אוסף עסק לא מוכר לאחר, ושם אותו אחרון גם כשהוא הגדול', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'משהו שלא ברשימה', actualAmount: 900 }),
      entry({ name: 'ארומה', actualAmount: 100 }),
    ])
    expect(slices.at(-1)).toMatchObject({ sector: OTHER, amount: 900 })
    expect(slices[0].sector).toBe('מסעדות ובתי קפה')
  })

  it('מחזיר ריק בלי רשומות', () => {
    expect(monthBreakdown([])).toEqual({ slices: [], total: 0 })
  })
})

describe('headlineSector', () => {
  // בסיס 20,000, ולכן יעד המשתנות הוא 6,000 והסף הוא 2,000
  const base = 20000

  it('אומר את המשפט כשענף עבר שליש מיעד המשתנות', () => {
    const result = headlineSector([entry({ name: 'מסעדות', actualAmount: 2000 })], base)
    expect(result).toMatchObject({ sector: 'מסעדות ובתי קפה', amount: 2000 })
    expect(result.share).toBeCloseTo(1 / 3)
  })

  it('שותק מתחת לסף', () => {
    expect(headlineSector([entry({ name: 'מסעדות', actualAmount: 1999 })], base)).toBeNull()
  })

  // זה הלב: המכנה הוא היעד ולא ההוצאה בפועל
  it('שותק בחודש שקט, גם כשענף אחד הוא כמעט כל ההוצאה', () => {
    const quiet = [
      entry({ name: 'ארומה', actualAmount: 400 }),
      entry({ name: 'זארה', actualAmount: 100 }),
    ]
    expect(headlineSector(quiet, base)).toBeNull()
  })

  it('מתעלם מסופר, שאינו הוצאה משתנה', () => {
    const rows = [entry({ category: 'fixed', name: 'שופרסל', actualAmount: 3000 })]
    expect(headlineSector(rows, base)).toBeNull()
  })

  it('מתעלם מחיוב קבוע', () => {
    const rows = [entry({ name: 'מסעדות', actualAmount: 3000, recurringId: 'r1' })]
    expect(headlineSector(rows, base)).toBeNull()
  })

  it('בוחר את הגדול כששניים חצו', () => {
    const rows = [
      entry({ name: 'מסעדות', actualAmount: 2100 }),
      entry({ name: 'זארה', actualAmount: 2600 }),
    ]
    expect(headlineSector(rows, base).sector).toBe('ביגוד והנעלה')
  })

  it('לעולם לא מכריז על "אחר", גם כשהוא רוב החודש', () => {
    const rows = [
      entry({ name: 'מתנה לאיתן', actualAmount: 4000 }),
      entry({ name: 'חתונה אדם וקורל', actualAmount: 3000 }),
      entry({ name: 'ארומה', actualAmount: 300 }),
    ]
    // "אחר" הוא ערימה של דברים שונים ולא ענף, ואין על מה להצביע בו
    expect(headlineSector(rows, base)).toBeNull()
  })

  it('שותק בלי בסיס, כי אין יעד להשוות אליו', () => {
    expect(headlineSector([entry({ name: 'מסעדות', actualAmount: 5000 })], 0)).toBeNull()
  })
})

describe('sectorColor', () => {
  it('נותן צבע לכל ענף שהמערכת מזהה', () => {
    for (const rule of SECTOR_RULES) {
      expect(sectorColor(rule.sector), rule.sector).toMatch(/^var\(--sec-/)
    }
  })

  it('לא נותן לשני ענפים באותה משפחה את אותו צבע', () => {
    const used = SECTOR_RULES.map((rule) => sectorColor(rule.sector))
    expect(new Set(used).size).toBe(used.length)
  })

  it('"אחר" וענף לא מוכר נופלים לנייטרלי', () => {
    expect(sectorColor(OTHER)).toBe('var(--color-neutral-500)')
    expect(sectorColor('ענף שלא קיים')).toBe('var(--color-neutral-500)')
  })

  it('אותו ענף מקבל אותו צבע ללא תלות בדירוג', () => {
    expect(sectorColor('מסעדות ובתי קפה')).toBe(sectorColor('מסעדות ובתי קפה'))
  })
})

describe('זיהוי ענף משם שהוקלד ביד', () => {
  it('שם של ענף הוא ענף, גם בלי בית עסק', () => {
    const rows = [
      entry({ name: 'תחבורה', actualAmount: 90 }),
      entry({ name: 'חניה', actualAmount: 40 }),
    ]
    expect(monthBreakdown(rows).slices.map((slice) => slice.sector))
      .toEqual(['תחבורה', 'חניה'])
  })

  it('"אוכל בחוץ" הוא מסעדות, לא "אחר"', () => {
    const rows = [entry({ name: 'אוכל בחוץ', actualAmount: 1421 })]
    expect(monthBreakdown(rows).slices[0].sector).toBe('מסעדות ובתי קפה')
  })

  it('"אוכל" לבדו נשאר לא מזוהה, כי הוא גם הסופר', () => {
    expect(monthBreakdown([entry({ name: 'אוכל', actualAmount: 100 })])
      .slices[0].sector).toBe(OTHER)
  })

  it('לא שובר זיהוי של בתי עסק אמיתיים', () => {
    const rows = [
      entry({ name: 'שופרסל דיל', actualAmount: 300 }),
      entry({ name: 'פז יעלים', actualAmount: 200 }),
    ]
    expect(monthBreakdown(rows).slices.map((slice) => slice.sector))
      .toEqual(['מזון ומשקאות', 'דלק ואנרגיה'])
  })
})

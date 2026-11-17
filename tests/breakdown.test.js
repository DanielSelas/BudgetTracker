import { describe, expect, it } from 'vitest'
import { OTHER, REST, chosenSpending, headlineSector, monthBreakdown, ringSlices, sectorColor, sliceColors } from '../src/lib/breakdown'
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

  it('שם שאינו מוכר מופיע בשמו ולא נבלע', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'משהו שלא ברשימה', actualAmount: 900 }),
      entry({ name: 'ארומה', actualAmount: 100 }),
    ])
    expect(slices.map((slice) => slice.sector))
      .toEqual(['משהו שלא ברשימה', 'מסעדות ובתי קפה'])
  })

  it('מאחד קבוצה, ענף ושם שמצביעים על אותו דבר', () => {
    // "קפה בחוץ" היא קבוצה שהשורות בתוכה נקראות אחרת, וכשהיא נלקחה
    // כשם היא ישבה כפלח נפרד ליד "מסעדות ובתי קפה" מאותן הוצאות
    const { slices } = monthBreakdown([
      entry({ name: 'ביס', groupKey: 'קפה בחוץ', actualAmount: 350 }),
      entry({ name: 'משהו', groupKey: 'אוכל בחוץ', actualAmount: 1421 }),
      entry({ name: 'ארומה', actualAmount: 380 }),
    ])
    expect(slices).toEqual([
      { sector: 'מסעדות ובתי קפה', amount: 2151, share: 1 },
    ])
  })

  it('מעדיף את מפתח הקיבוץ על השם, כמו מסך החודש', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'קפה בחוץ ביום שני', groupKey: 'קפה בחוץ', actualAmount: 30 }),
    ])
    // כאן הענף מנצח בכל מקרה, ולכן נבדק דווקא שם שאין לו ענף
    const typed = monthBreakdown([
      entry({ name: 'מוסך אלי רמלה', groupKey: 'מוסך', actualAmount: 900 }),
    ])
    expect(slices[0].sector).toBe('מסעדות ובתי קפה')
    expect(typed.slices[0].sector).toBe('מוסך')
  })

  it('שורה בלי שם בכלל נופלת לאחר, והוא אחרון', () => {
    const { slices } = monthBreakdown([
      entry({ name: '', actualAmount: 900 }),
      entry({ name: 'ארומה', actualAmount: 100 }),
    ])
    expect(slices.at(-1)).toMatchObject({ sector: OTHER, amount: 900 })
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

  it('סופר את הקבוצה כמו הטבעת, ולא מצטט מספר אחר ממנה', () => {
    const rows = [
      entry({ name: 'ארומה', actualAmount: 1900 }),
      entry({ name: 'ביס', groupKey: 'קפה בחוץ', actualAmount: 350 }),
    ]
    const { slices } = monthBreakdown(rows)
    expect(headlineSector(rows, base).amount).toBe(slices[0].amount)
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

  it('"אחר" ו"שאר" נופלים לנייטרלי, כי הם ערימה ולא ענף', () => {
    expect(sectorColor(OTHER)).toBe('var(--color-neutral-500)')
    expect(sectorColor(REST)).toBe('var(--color-neutral-500)')
    expect(sectorColor('')).toBe('var(--color-neutral-500)')
  })

  it('שם שהוקלד ביד מקבל צבע מהפלטה, ואותו צבע בכל פעם', () => {
    const color = sectorColor('מתנה')
    expect(color).toMatch(/^var\(--sec-/)
    expect(sectorColor('מתנה')).toBe(color)
    expect(sectorColor('רכב')).toMatch(/^var\(--sec-/)
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
      .slices[0].sector).toBe('אוכל')
  })

  it('רווח כפול או רווח קשיח לא מפילים זיהוי', () => {
    for (const name of ['אוכל  בחוץ', 'אוכל\u00a0בחוץ', ' אוכל בחוץ ']) {
      expect(monthBreakdown([entry({ name, actualAmount: 100 })]).slices[0].sector,
        JSON.stringify(name)).toBe('מסעדות ובתי קפה')
    }
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

describe('איחוד לפי מילה ראשונה', () => {
  it('מאחד "מתנה לאיתן" ו"מתנה לדוזי" ל"מתנה"', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'מתנה לאיתן', actualAmount: 200 }),
      entry({ name: 'מתנה לדוזי', actualAmount: 130 }),
    ])
    expect(slices).toEqual([{ sector: 'מתנה', amount: 330, share: 1 }])
  })

  it('לא מאחד שם יחיד', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'מתנה לאיתן', actualAmount: 200 }),
      entry({ name: 'רכב', actualAmount: 100 }),
    ])
    expect(slices.map((slice) => slice.sector)).toEqual(['מתנה לאיתן', 'רכב'])
  })

  it('לא מאחד לפי מילה משותפת שאינה ראשונה', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'ציוד בחוץ', actualAmount: 200 }),
      entry({ name: 'משהו בחוץ', actualAmount: 100 }),
    ])
    expect(slices).toHaveLength(2)
  })

  it('לא מאחד ענפים מוכרים', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'ארומה', actualAmount: 200 }),
      entry({ name: 'מסעדת ליבירה', actualAmount: 100 }),
      entry({ name: 'שופרסל', actualAmount: 100 }),
    ])
    expect(slices.map((slice) => slice.sector))
      .toEqual(['מסעדות ובתי קפה', 'מזון ומשקאות'])
  })
})

describe('ringSlices', () => {
  // שמות עם מילה ראשונה שונה, אחרת האיחוד היה מכווץ אותם לפלח אחד
  const many = (count) => Array.from({ length: count }, (unused, index) =>
    entry({ name: `ע${index} חנות`, actualAmount: 100 - index }))

  it('מחזיר הכל כשיש עד שמונה', () => {
    const { slices } = monthBreakdown(many(8))
    expect(ringSlices(slices)).toHaveLength(8)
  })

  it('לא אוסף פלח בודד, כי זה רק מוחק לו את השם', () => {
    const { slices } = monthBreakdown(many(9))
    expect(ringSlices(slices)).toHaveLength(9)
    expect(ringSlices(slices).at(-1).sector).not.toBe(REST)
  })

  it('אוסף את הזנב לפלח אחד, בלי לאבד כסף', () => {
    const { slices, total } = monthBreakdown(many(12))
    const ring = ringSlices(slices)
    expect(ring).toHaveLength(9)
    expect(ring.at(-1).sector).toBe(REST)
    expect(ring.reduce((sum, slice) => sum + slice.amount, 0)).toBe(total)
  })

  it('הרשימה המלאה אינה נוגעת בזנב', () => {
    const { slices } = monthBreakdown(many(12))
    expect(slices).toHaveLength(12)
  })
})

describe('sliceColors', () => {
  it('לא נותן לשני פלחים באותו חודש את אותו צבע', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'ארומה', actualAmount: 500 }),
      entry({ name: 'שופרסל', actualAmount: 400 }),
      entry({ name: 'מוסך אלי', actualAmount: 300 }),
      entry({ name: 'רכב', actualAmount: 200 }),
      entry({ name: 'מתנה לאיתן', actualAmount: 100 }),
      entry({ name: 'בילי וגרי', actualAmount: 90 }),
    ])
    const fills = sliceColors(slices)
    expect(new Set(fills.values()).size).toBe(slices.length)
  })

  it('ענף מוכר שומר על הצבע הקבוע שלו', () => {
    const { slices } = monthBreakdown([
      entry({ name: 'ארומה', actualAmount: 100 }),
      entry({ name: 'משהו ביד', actualAmount: 90 }),
    ])
    expect(sliceColors(slices).get('מסעדות ובתי קפה'))
      .toBe(sectorColor('מסעדות ובתי קפה'))
  })

  it('"שאר" אפור גם כשהוא בטבעת בלבד', () => {
    const slices = [{ sector: 'ארומה' }, { sector: REST }]
    expect(sliceColors(slices).get(REST)).toBe('var(--color-neutral-500)')
  })
})

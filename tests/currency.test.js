import { describe, expect, it } from 'vitest'
import {
  byCurrency, guessCurrency, parseChargeTotals, reconcile, toShekels, totalsForFile,
} from '../src/lib/currency'

/**
 * דוח של כרטיס בנקאי מכיל גם חיובים בדולר ובאירו, ועמודת "מטבע
 * העסקה" נשארת ריקה בכל השורות. שורת הסיכום בראש הקובץ היא הנתון
 * היחיד שאומר כמה יצא בכל מטבע, ולכן היא האמת שמולה נבדק הניחוש.
 */
describe('שורת הסיכום', () => {
  const line = 'עסקאות באשראי - סה"כ חיוב: + ₪4352.37 + $123.6 + €646.73'

  it('נקראת לפי הסדר, עם המטבע של כל סכום', () => {
    expect(parseChargeTotals(line)).toEqual([
      { currency: 'ILS', amount: 4352.37 },
      { currency: 'USD', amount: 123.6 },
      { currency: 'EUR', amount: 646.73 },
    ])
  })

  it('וגם עם מפרידי אלפים', () => {
    expect(parseChargeTotals('₪1,234.50')).toEqual([{ currency: 'ILS', amount: 1234.5 }])
  })

  it('שורה בלי סכומים מחזירה ריק', () => {
    expect(parseChargeTotals('אין כאן כלום')).toEqual([])
    expect(parseChargeTotals(null)).toEqual([])
  })
})

describe('אילו סכומים שייכים לקובץ', () => {
  /**
   * השורה מצטברת בין קבצים, ולכן היא מכילה גם חודשים קודמים. מה
   * ששייך לקובץ הוא הסיומת שמסתכמת בדיוק בסכום השורות שבו.
   */
  const terms = parseChargeTotals('₪4352.37 + $123.6 + €646.73 + ₪2471.88 + $20')

  it('הסיומת שמסתכמת בסכום השורות', () => {
    expect(totalsForFile(terms, 2491.88)).toEqual([
      { currency: 'ILS', amount: 2471.88 },
      { currency: 'USD', amount: 20 },
    ])
  })

  it('קובץ ראשון לוקח את כל השורה', () => {
    const only = parseChargeTotals('₪4352.37 + $123.6 + €646.73')
    expect(totalsForFile(only, 5122.7)).toHaveLength(3)
  })

  it('בלי התאמה מחזירה null במקום להמציא חלוקה', () => {
    expect(totalsForFile(terms, 999)).toBe(null)
  })

  it('אותו מטבע שמופיע פעמיים מסוכם', () => {
    expect([...byCurrency([
      { currency: 'ILS', amount: 100 },
      { currency: 'USD', amount: 20 },
      { currency: 'ILS', amount: 50 },
    ])]).toEqual([['ILS', 150], ['USD', 20]])
  })
})

describe('ניחוש המטבע של שורה', () => {
  it('עסקה בישראל היא תמיד שקלים', () => {
    expect(guessCurrency({ name: 'מאפיית סניורה', type: 'רגיל-ישראל' })).toBe('ILS')
  })

  it('סיומת המדינה קובעת', () => {
    expect(guessCurrency({ name: '3 BOCA RATON US', type: 'רגיל-חו"ל' })).toBe('USD')
    expect(guessCurrency({ name: 'Los Gatos NL', type: 'רגיל-חו"ל' })).toBe('EUR')
    expect(guessCurrency({ name: 'TIENDA ES', type: 'רגיל-חו"ל' })).toBe('EUR')
  })

  it('אבל סימון מפורש של חיוב בשקלים גובר עליה', () => {
    expect(guessCurrency({
      name: 'Los Gatos NL', type: 'רגיל-חו"ל', note: 'חיוב עסקת חו"ל בש"ח',
    })).toBe('ILS')
  })

  it('מדינה שאינה מוכרת מחזירה ריק, ולא ניחוש', () => {
    expect(guessCurrency({ name: 'eEastLLC Dubai AE', type: 'רגיל-חו"ל' })).toBe('')
  })
})

describe('הצלבה מול שורת הסיכום', () => {
  const rows = [
    { name: 'מאפיית סניורה', type: 'רגיל-ישראל', amount: 130 },
    { name: '3 BOCA RATON US', type: 'רגיל-חו"ל', amount: 20 },
  ]

  it('הסכמה מלאה מאפשרת להמיר בביטחון', () => {
    const totals = parseChargeTotals('₪130 + $20')
    expect(reconcile(rows, totals).agrees).toBe(true)
  })

  /**
   * באוקטובר האמיתי כל העסקאות עם סיומת US חויבו דווקא בשקלים.
   * המרה לפי הניחוש הייתה מכפילה אותן פי שלושה וחצי.
   */
  it('פיצול שגוי נתפס, גם כשהסכום הכולל נכון', () => {
    const totals = parseChargeTotals('₪150')
    const result = reconcile(rows, totals)
    expect(result.agrees).toBe(false)
    expect(result.reason).toBe('mismatch')
  })

  it('בלי שורת סיכום אין על מה להסתמך', () => {
    expect(reconcile(rows, null).agrees).toBe(false)
    expect(reconcile(rows, null).reason).toBe('no-totals')
  })

  it('מטבע שלא זוהה נספר בנפרד ולכן שובר את ההסכמה', () => {
    const withUnknown = [...rows, { name: 'Dubai AE', type: 'רגיל-חו"ל', amount: 216.05 }]
    expect(reconcile(withUnknown, parseChargeTotals('₪130 + $20')).agrees).toBe(false)
  })
})

describe('המרה לשקלים', () => {
  it('שקל נשאר כמו שהוא', () => {
    expect(toShekels(130, 'ILS', { USD: 3.7 })).toBe(130)
  })

  it('ומטבע אחר מוכפל בשער', () => {
    expect(toShekels(100, 'USD', { USD: 3.7 })).toBe(370)
  })

  it('בלי שער התוצאה אפס, כדי שלא ייכנס סכום שגוי בשקט', () => {
    expect(toShekels(100, 'USD', {})).toBe(0)
  })
})

describe('המרת קובץ שלם', () => {
  const rows = [
    { name: 'מאפיית סניורה', type: 'רגיל-ישראל', amount: 130 },
    { name: '3 BOCA RATON US', type: 'רגיל-חו"ל', amount: 20 },
  ]

  it('בלי עסקאות חו"ל השורות עוברות כמו שהן', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const only = [rows[0]]
    const result = applyCurrency(only, { totalsLine: '₪130' })
    expect(result.rows).toEqual(only)
    expect(result.needsRates).toEqual([])
  })

  it('כשיש הסכמה ושער, הסכום מומר', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, { totalsLine: '₪130 + $20', rates: { USD: 3.7 } })
    expect(result.agrees).toBe(true)
    expect(result.rows[1].amount).toBe(74)
    expect(result.rows[1].original).toBe(20)
    expect(result.rows[1].currency).toBe('USD')
    // שורה שקלית לא נגעו בה
    expect(result.rows[0].amount).toBe(130)
  })

  it('כשיש הסכמה וחסר שער, נאמר איזה שער חסר', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, { totalsLine: '₪130 + $20' })
    expect(result.needsRates).toEqual(['USD'])
  })

  /**
   * זה הלב: בלי הסכמה הפיצול בין המטבעות שגוי, ולכן המרה לפיו
   * הייתה מכניסה סכומים שנראים אמינים ואינם נכונים.
   */
  it('בלי הסכמה שורות חו"ל מדולגות ולא מומרות', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, { totalsLine: '₪150', rates: { USD: 3.7 } })
    expect(result.agrees).toBe(false)
    expect(result.dropped).toBe(1)
    expect(result.rows).toEqual([rows[0]])
  })
})

describe('שיוך שורה שהמטבע שלה לא זוהה', () => {
  /**
   * מדינה שאינה ברשימת גוש האירו משאירה שורה בלי מטבע, ואז ההצלבה
   * נשברת גם כשכל השאר נכון. בנובמבר האמיתי זו הייתה שורה אחת של
   * 56.47 שמנעה ייבוא של חודש שלם.
   */
  const rows = [
    { name: 'מאפיית סניורה', type: 'רגיל-ישראל', amount: 130 },
    { name: 'STOCKHOLM SE', type: 'רגיל-חו"ל', amount: 20 },
  ]

  it('שיוך יחיד שמיישב את ההצלבה מתקבל', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    // 150 בשקלים פירושו שהשורה השוודית חויבה בשקלים
    const result = applyCurrency(rows, { totalsLine: '₪150' })
    expect(result.agrees).toBe(true)
    expect(result.dropped).toBe(0)
  })

  it('כששני שיוכים אפשריים, אין הכרעה', async () => {
    const { resolveUnknown } = await import('../src/lib/currency')
    // שתי שורות לא מזוהות בסכום זהה: אי אפשר לדעת מי לאן
    const expected = new Map([['ILS', 130], ['USD', 20], ['EUR', 20]])
    const two = [...rows, { name: 'OSLO NO', type: 'רגיל-חו"ל', amount: 20 }]
    expect(resolveUnknown(two, expected)).toBe('')
  })

  it('וכשאין שיוך שמיישב, השורות מדולגות', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, { totalsLine: '₪130 + $999' })
    expect(result.agrees).toBe(false)
    expect(result.dropped).toBe(1)
  })
})

describe('דילוג על מט״ח', () => {
  const rows = [
    { name: 'מאפיית סניורה', type: 'רגיל-ישראל', amount: 130 },
    { name: '3 BOCA RATON US', type: 'רגיל-חו"ל', amount: 20 },
  ]

  it('שורות שאינן שקליות לא נכנסות, וגם לא מומרות', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, {
      totalsLine: '₪130 + $20', rates: { USD: 3.7 }, skipForeign: true,
    })
    expect(result.rows).toEqual([rows[0]])
    expect(result.dropped).toBe(1)
    // ההצלבה עדיין הסכימה, וזה מה שמאפשר לדעת על מה דילגנו
    expect(result.agrees).toBe(true)
  })

  /**
   * הזיהוי נחוץ גם כשמדלגים: באוקטובר האמיתי כל בתי העסק
   * האמריקאיים חויבו בשקלים, ודילוג לפי הניחוש לבדו היה זורק
   * הוצאות אמיתיות.
   */
  it('הסכום שדולג מדווח לפי מטבע', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency(rows, { totalsLine: '₪130 + $20', skipForeign: true })
    expect([...result.foreign]).toEqual([['USD', 20]])
  })

  it('קובץ שקלי לגמרי עובר שלם', async () => {
    const { applyCurrency } = await import('../src/lib/currency')
    const result = applyCurrency([rows[0]], { totalsLine: '₪130', skipForeign: true })
    expect(result.rows).toHaveLength(1)
    expect(result.dropped).toBe(0)
  })
})

describe('שתי עמודות הסכום כראיה למטבע', () => {
  /**
   * סכום חיוב ששונה מסכום העסקה פירושו שבוצעה המרה, כלומר החיוב
   * יצא בשקלים. זהים פירושו שלא הייתה המרה והחיוב יצא במטבע המקור.
   *
   * זו ראיה ישירה, בניגוד לסיומת בשם בית העסק שהיא ניחוש. באוקטובר
   * האמיתי כל בתי העסק האמריקאיים נראו כדולרים, ובפועל כרטיסי
   * הטיסה חויבו בשקלים: 446.61 הפכו ל-1733.26, שער 3.88.
   */
  it('סכומים שונים פירושם שהחיוב יצא בשקלים', () => {
    expect(guessCurrency({
      name: '12281427 WWW.AA.COM US', type: 'רגיל-חו"ל', gross: 446.61, amount: 1733.26,
    })).toBe('ILS')
  })

  it('סכומים זהים פירושם חיוב במטבע המקור', () => {
    expect(guessCurrency({
      name: 'T SUBSCR OPENAI.COM US', type: 'רגיל-חו"ל', gross: 20, amount: 20,
    })).toBe('USD')
  })

  it('הראיה גוברת על הסיומת בשם', () => {
    // אותו בית עסק, אותה מדינה, ושתי תשובות שונות
    const merchant = { name: 'SHOP US', type: 'רגיל-חו"ל' }
    expect(guessCurrency({ ...merchant, gross: 100, amount: 100 })).toBe('USD')
    expect(guessCurrency({ ...merchant, gross: 100, amount: 388 })).toBe('ILS')
  })

  it('גם על סכומים שליליים, כי זיכוי הוא אותה עסקה בכיוון ההפוך', () => {
    expect(guessCurrency({
      name: 'SHOP US', type: 'רגיל-חו"ל', gross: 100, amount: -100,
    })).toBe('USD')
  })

  it('בלי עמודת סכום שנייה חוזרים לסיומת', () => {
    expect(guessCurrency({ name: 'SHOP US', type: 'רגיל-חו"ל' })).toBe('USD')
    expect(guessCurrency({ name: 'SHOP US', type: 'רגיל-חו"ל', gross: null, amount: 100 }))
      .toBe('USD')
  })
})

import { describe, expect, it, vi } from 'vitest'

// הכתיבה נוגעת ב-Firestore, והבדיקות כאן על המזהים בלבד
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn(async () => {}) })),
}))
vi.mock('../src/lib/firebase', () => ({ db: {} }))
import { detectDelimiter, parseCsv, splitLine } from '../src/lib/csv'
import {
  byMerchant, detectColumns, extractRows, findHeaderRow, installmentPlan,
  parseAmount, parseDate, parseInstallment,
} from '../src/lib/importRows'

/**
 * הקבצים כאן מדמים ייצוא אמיתי: שורות כותרת מיותרות מעל, מפריד שאינו
 * פסיק, סכומים עם פסיק ומטבע, ותאריכים בסדר ישראלי.
 */
const ISRAELI_EXPORT = `דוח עסקאות
כרטיס מסתיים ב-1234
תקופה: 10/09/2026 - 10/10/2026

תאריך עסקה;שם בית העסק;סכום חיוב
03/09/2026;שופרסל דיל;"1,240.50"
05/09/2026;פז יעלים;320
07/09/2026;שופרסל דיל;38
08/09/2026;זיכוי;-150
`

describe('פענוח CSV', () => {
  it('מכבד מרכאות ופסיק בתוך שדה', () => {
    expect(splitLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd'])
    expect(splitLine('a,"say ""hi""",b', ',')).toEqual(['a', 'say "hi"', 'b'])
  })

  it('מזהה מפריד שאינו פסיק', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
  })
})

describe('תאריך וסכום מקובץ אמיתי', () => {
  it('סדר ישראלי, יום לפני חודש', () => {
    expect(parseDate('03/09/2026')).toBe('2026-09-03')
    expect(parseDate('3.9.26')).toBe('2026-09-03')
    expect(parseDate('2026-09-03')).toBe('2026-09-03')
  })

  it('דוחה מה שאינו תאריך', () => {
    expect(parseDate('שופרסל')).toBe('')
    expect(parseDate('45/09/2026')).toBe('')
    expect(parseDate('')).toBe('')
  })

  it('סכום עם פסיק, מטבע וסוגריים', () => {
    expect(parseAmount('1,240.50')).toBe(1240.5)
    expect(parseAmount('₪320')).toBe(320)
    expect(parseAmount('(150)')).toBe(-150)
    expect(parseAmount('-150')).toBe(-150)
    expect(parseAmount('שופרסל')).toBeNull()
  })
})

describe('הבנת הקובץ', () => {
  const rows = parseCsv(ISRAELI_EXPORT)

  it('מדלג על שורות הכותרת המיותרות ומוצא את השורה האמיתית', () => {
    expect(rows[findHeaderRow(rows)][0]).toBe('תאריך עסקה')
  })

  it('מזהה איזו עמודה היא מה', () => {
    const mapping = detectColumns(rows)
    expect(rows[mapping.headerRow][mapping.date]).toBe('תאריך עסקה')
    expect(rows[mapping.headerRow][mapping.amount]).toBe('סכום חיוב')
    expect(rows[mapping.headerRow][mapping.name]).toBe('שם בית העסק')
  })

  it('מוציא את השורות, כולל זיכוי כסכום שלילי', () => {
    const { rows: out, skipped } = extractRows(rows, detectColumns(rows))
    expect(out).toHaveLength(4)
    expect(skipped).toBe(0)
    expect(out[0]).toMatchObject({
      date: '2026-09-03', month: '2026-09', amount: 1240.5, name: 'שופרסל דיל',
    })
    // זיכוי הוא הוצאה שקוזזה, ולכן הוא נכנס ומקזז
    expect(out[3]).toMatchObject({ amount: -150, name: 'זיכוי' })
  })

  it('מקבץ לפי בית עסק, מהגדול לקטן', () => {
    const { rows: out } = extractRows(rows, detectColumns(rows))
    const groups = byMerchant(out)
    // שופרסל ופז נכנסים לקבוצות הקבועות שלהם, ולכן אלה השמות
    expect(groups.map((group) => group.name)).toEqual(['סופר', 'דלק', 'זיכוי'])
    expect(groups[0].total).toBe(1278.5)
    expect(groups[0].rows).toHaveLength(2)
    // הזיכוי מופיע כקבוצה עם סכום שלילי, ולכן הוא אחרון בדירוג
    expect(groups[2].total).toBe(-150)
  })
})

describe('מזהי שורות מיובאות', () => {
  it('אותה שורה מקבלת אותו מזהה, ולכן ייבוא חוזר לא משכפל', async () => {
    const { importedIds } = await import('../src/lib/importEntries')
    const rows = [{ date: '2026-09-03', amount: 1240.5, name: 'שופרסל דיל' }]
    expect(importedIds(rows)).toEqual(importedIds(rows))
  })

  it('שתי קניות זהות באותו יום הן שתי שורות', async () => {
    const { importedIds } = await import('../src/lib/importEntries')
    const row = { date: '2026-09-03', amount: 38, name: 'קפה' }
    const ids = importedIds([row, row])
    expect(ids[0]).not.toBe(ids[1])
    // ויציב: אותה רשימה נותנת אותם שני מזהים
    expect(importedIds([row, row])).toEqual(ids)
  })

  it('שורות שונות נבדלות', async () => {
    const { importedIds } = await import('../src/lib/importEntries')
    const ids = importedIds([
      { date: '2026-09-03', amount: 38, name: 'קפה' },
      { date: '2026-09-03', amount: 39, name: 'קפה' },
      { date: '2026-09-04', amount: 38, name: 'קפה' },
      { date: '2026-09-03', amount: 38, name: 'מאפה' },
    ])
    expect(new Set(ids).size).toBe(4)
  })

  it('המזהה קריא ומתחיל בתאריך', async () => {
    const { importedIds } = await import('../src/lib/importEntries')
    const [id] = importedIds([{ date: '2026-09-03', amount: 38, name: 'שופרסל דיל' }])
    expect(id.startsWith('imp_2026-09-03_שופרסל-דיל_')).toBe(true)
  })
})

describe('לאיזה חודש הקובץ נכנס', () => {
  it('מדווח על כל החודשים שהקובץ נוגע בהם', async () => {
    const { monthsIn } = await import('../src/lib/importRows')
    expect(monthsIn([
      { month: '2026-09' }, { month: '2026-10' }, { month: '2026-09' },
    ])).toEqual(['2026-09', '2026-10'])
  })

  it('קובץ שכולו חודש אחד מדווח חודש אחד', async () => {
    const { monthsIn } = await import('../src/lib/importRows')
    expect(monthsIn([{ month: '2026-09' }, { month: '2026-09' }])).toEqual(['2026-09'])
    expect(monthsIn([])).toEqual([])
  })
})

describe('קריאת xlsx', () => {
  it('מספר סידורי של אקסל אל תאריך', async () => {
    const { serialToDate } = await import('../src/lib/xlsx')
    // הבסיס הוא 30.12.1899, ולא 1.1.1900, בגלל באג השנה המעוברת
    expect(serialToDate(46268)).toBe('2026-09-03')
    expect(serialToDate(46297)).toBe('2026-10-02')
    expect(serialToDate(1)).toBe('1899-12-31')
  })

  it('דוחה ערך שאינו מספר סידורי', async () => {
    const { serialToDate } = await import('../src/lib/xlsx')
    expect(serialToDate(0)).toBe('')
    expect(serialToDate('שופרסל')).toBe('')
  })

  it('אסמכתת תא אל אינדקס עמודה', async () => {
    const { columnIndex } = await import('../src/lib/xlsx')
    expect(columnIndex('A1')).toBe(0)
    expect(columnIndex('B2')).toBe(1)
    expect(columnIndex('Z10')).toBe(25)
    // מעבר ל-Z, שם חישוב נאיבי נשבר
    expect(columnIndex('AA1')).toBe(26)
    expect(columnIndex('BC12')).toBe(54)
  })
})

describe('זיהוי הפורמט לפי התוכן', () => {
  const asFile = (bytes, name) => {
    const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
    return new File([data], name)
  }

  it('ZIP הוא xlsx, גם כשהסיומת אומרת אחרת', async () => {
    const { sniff } = await import('../src/lib/readAny')
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    expect(await sniff(asFile(zip, 'report.xls'))).toBe('xlsx')
  })

  it('טבלת HTML מזוהה גם כשהקובץ נקרא xlsx', async () => {
    const { sniff } = await import('../src/lib/readAny')
    const html = '<html><body><table><tr><td>a</td></tr></table></body></html>'
    expect(await sniff(asFile(html, 'bank.xlsx'))).toBe('html')
  })

  it('פורמט אקסל בינארי ישן מזוהה ולא מתפרש כטקסט', async () => {
    const { sniff } = await import('../src/lib/readAny')
    const old = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])
    expect(await sniff(asFile(old, 'report.xls'))).toBe('xls')
  })

  it('כל השאר נקרא כ-CSV', async () => {
    const { sniff } = await import('../src/lib/readAny')
    expect(await sniff(asFile('a,b,c\n1,2,3', 'data.txt'))).toBe('csv')
  })
})

describe('טבלת HTML', () => {
  it('בוחרת את הטבלה הגדולה, כי קבצים כאלה עוטפים בטבלאות פריסה', async () => {
    const { readHtmlTable } = await import('../src/lib/htmlTable')
    const html = `<table><tr><td>כותרת עליונה</td></tr></table>
      <table>
        <tr><th>תאריך</th><th>עסק</th><th>סכום</th></tr>
        <tr><td>03/09/2026</td><td>שופרסל</td><td>1,240</td></tr>
        <tr><td>05/09/2026</td><td>פז</td><td>320</td></tr>
      </table>`
    const rows = readHtmlTable(html)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual(['03/09/2026', 'שופרסל', '1,240'])
  })

  it('בלי טבלה מחזירה ריק במקום לזרוק', async () => {
    const { readHtmlTable } = await import('../src/lib/htmlTable')
    expect(readHtmlTable('<html><body>שלום</body></html>')).toEqual([])
  })
})

describe('שתי עמודות סכום', () => {
  /**
   * דוח אשראי אמיתי מכיל "סכום עסקה" ו"סכום חיוב". בעסקה במט״ח הן
   * שונות, ומה שירד בפועל הוא החיוב.
   */
  const rows = [
    ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף'],
    ['08/04/2025', 'מנו וינו', '60', '244.9', 'מזון'],
    ['07/04/2025', 'WOLT', '40', '153.9', 'מסעדות'],
    ['06/04/2025', 'קפה בליך', '4', '14', 'מסעדות'],
  ]

  it('בוחר את סכום החיוב ולא את סכום העסקה', () => {
    const mapping = detectColumns(rows)
    expect(rows[mapping.headerRow][mapping.amount]).toBe('סכום חיוב')
  })

  it('וגם את העמודות האחרות נכון', () => {
    const mapping = detectColumns(rows)
    expect(rows[mapping.headerRow][mapping.date]).toBe('תאריך עסקה')
    expect(rows[mapping.headerRow][mapping.name]).toBe('שם בית עסק')
  })

  it('הסכומים שנקראים הם של החיוב', () => {
    const { rows: out } = extractRows(rows, detectColumns(rows))
    expect(out.map((row) => row.amount)).toEqual([244.9, 153.9, 14])
  })
})

describe('סוג עסקה', () => {
  /**
   * בקובץ האמיתי יש עמודת "סוג עסקה" עם ערכים כמו "רגילה" או
   * "הוראת קבע". הוראת קבע היא הוצאה קבועה מבחינה מבנית, בלי קשר
   * לענף שלה, ולכן היא גוברת על ההצעה לפי הענף.
   */
  const rows = [
    ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'סוג עסקה', 'ענף'],
    ['08/04/2025', 'מנו וינו', '60', '244.9', 'רגילה', 'מסעדות'],
    ['07/04/2025', 'חדר כושר', '199', '199', 'הוראת קבע', 'ספורט ופנאי'],
    ['06/04/2025', 'חדר כושר', '199', '199', 'הוראת קבע', 'ספורט ופנאי'],
  ]
  const mapping = detectColumns(rows)

  it('מזוהה כעמודה נפרדת מהסכום ומהענף', () => {
    expect(rows[mapping.headerRow][mapping.type]).toBe('סוג עסקה')
    expect(rows[mapping.headerRow][mapping.amount]).toBe('סכום חיוב')
    expect(rows[mapping.headerRow][mapping.sector]).toBe('ענף')
  })

  it('הסוג נשמר על כל שורה ועל הקבוצה', () => {
    const { rows: out } = extractRows(rows, mapping)
    expect(out.map((row) => row.type)).toEqual(['רגילה', 'הוראת קבע', 'הוראת קבע'])
    const gym = byMerchant(out).find((group) => group.name === 'חדר כושר')
    expect(gym.type).toBe('הוראת קבע')
  })

  it('הוראת קבע מסווגת כקבועה גם כשהענף הוא פנאי', async () => {
    const { suggestCategory, isStanding } = await import('../src/lib/sectors')
    expect(isStanding('הוראת קבע')).toBe(true)
    expect(isStanding('רגילה')).toBe(false)

    expect(suggestCategory({ sector: 'ספורט ופנאי', type: 'הוראת קבע' }))
      .toEqual({ category: 'fixed', source: 'standing' })
    expect(suggestCategory({ sector: 'ספורט ופנאי', type: 'רגילה' }))
      .toEqual({ category: 'leisure', source: 'seed' })
  })

  it('מה שנלמד על הענף גובר על ניחוש הפתיחה אבל לא על הוראת קבע', async () => {
    const { suggestCategory } = await import('../src/lib/sectors')
    const rules = { 'ספורט ופנאי': 'fund' }
    expect(suggestCategory({ sector: 'ספורט ופנאי', type: 'רגילה' }, rules))
      .toEqual({ category: 'fund', source: 'rule' })
    expect(suggestCategory({ sector: 'ספורט ופנאי', type: 'הוראת קבע' }, rules).source)
      .toBe('standing')
  })

  it('קובץ בלי עמודת סוג ממשיך לעבוד', () => {
    const plain = [
      ['תאריך', 'שם בית עסק', 'סכום', 'ענף'],
      ['08/04/2025', 'מנו וינו', '244.9', 'מסעדות'],
    ]
    const map = detectColumns(plain)
    expect(map.type).toBe(-1)
    expect(extractRows(plain, map).rows[0].type).toBe('')
  })
})

describe('עמודות אופציונליות', () => {
  it('עמודת הערות לא נתפסת כענף או כסוג', () => {
    const rows = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['08/04/2025', 'מנו וינו', '244.9', 'שולם במזומן'],
      ['07/04/2025', 'WOLT', '153.9', 'הזמנה לבית'],
    ]
    const mapping = detectColumns(rows)
    expect(mapping.sector).toBe(-1)
    expect(mapping.type).toBe(-1)
  })
})

describe('תשלומים', () => {
  /**
   * בעמודת ההערות מופיע לפעמים "תשלום 1 מתוך 3". זה לא טקסט חופשי
   * אלא נתון: הסכום בשורה הוא התשלום החודשי ולא המחיר, ויש עוד
   * תשלומים שכבר התחייבנו אליהם.
   */
  it('קורא את מספר התשלום מתוך ההערה', () => {
    expect(parseInstallment('תשלום 1 מתוך 3')).toEqual({ index: 1, total: 3 })
    expect(parseInstallment('תשלום 02 מתוך 12')).toEqual({ index: 2, total: 12 })
    expect(parseInstallment('תשלום 3/3')).toEqual({ index: 3, total: 3 })
  })

  it('מתעלם ממה שאינו עסקת תשלומים', () => {
    expect(parseInstallment('')).toBe(null)
    expect(parseInstallment('שולם במזומן')).toBe(null)
    // תשלום יחיד אינו עסקת תשלומים, והפוך מזה הוא שיבוש
    expect(parseInstallment('תשלום 1 מתוך 1')).toBe(null)
    expect(parseInstallment('תשלום 4 מתוך 3')).toBe(null)
  })

  const rows = [
    ['תאריך עסקה', 'שם בית עסק', 'סכום חיוב', 'ענף', 'הערות'],
    ['08/04/2025', 'מכשירי חשמל', '500', 'חשמל', 'תשלום 1 מתוך 3'],
    ['08/04/2025', 'מנו וינו', '244.9', 'מסעדות', ''],
    ['09/05/2025', 'רהיטים', '300', 'ריהוט', 'תשלום 2 מתוך 3'],
  ]

  it('עמודת ההערות מזוהה ונשמרת על השורה', () => {
    const mapping = detectColumns(rows)
    expect(rows[mapping.headerRow][mapping.note]).toBe('הערות')
    const { rows: out } = extractRows(rows, mapping)
    expect(out[0].note).toBe('תשלום 1 מתוך 3')
    expect(out[0].installment).toEqual({ index: 1, total: 3 })
    expect(out[1].installment).toBe(null)
  })

  it('התשלומים הבאים מתפרסים על החודשים שאחרי', () => {
    const { rows: out } = extractRows(rows, detectColumns(rows))
    const plan = installmentPlan(out)
    expect(plan.count).toBe(2)
    // שניים שנותרו מהחשמל, ואחד שנותר מהרהיטים
    expect(plan.total).toBe(1300)
    expect(plan.byMonth).toEqual([
      { month: '2025-05', amount: 500 },
      { month: '2025-06', amount: 800 },
    ])
  })

  it('התשלום האחרון לא מוסיף התחייבות', () => {
    const last = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['08/04/2025', 'רהיטים', '300', 'תשלום 3 מתוך 3'],
    ]
    const { rows: out } = extractRows(last, detectColumns(last))
    expect(installmentPlan(out)).toEqual({ count: 0, total: 0, byMonth: [] })
  })

  it('זיכוי בתשלומים לא נספר כהתחייבות עתידית', () => {
    const refund = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['08/04/2025', 'רהיטים', '-300', 'תשלום 1 מתוך 3'],
    ]
    const { rows: out } = extractRows(refund, detectColumns(refund))
    expect(installmentPlan(out).total).toBe(0)
  })

  it('עסקה שמופיעה בכמה חודשים נספרת פעם אחת בלבד', () => {
    // אותה קנייה ירדה באפריל ובמאי, ולכן נשאר רק יוני. ספירה של כל
    // שורה בנפרד הייתה מכפילה את יוני
    const many = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['08/04/2025', 'רהיטים', '300', 'תשלום 1 מתוך 3'],
      ['08/05/2025', 'רהיטים', '300', 'תשלום 2 מתוך 3'],
    ]
    const { rows: out } = extractRows(many, detectColumns(many))
    const plan = installmentPlan(out)
    expect(plan.count).toBe(1)
    expect(plan.byMonth).toEqual([{ month: '2025-06', amount: 300 }])
  })

  it('הקבוצה מציגה את מצב התשלומים העדכני', () => {
    const many = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['08/04/2025', 'רהיטים', '300', 'תשלום 1 מתוך 3'],
      ['08/05/2025', 'רהיטים', '300', 'תשלום 2 מתוך 3'],
    ]
    const { rows: out } = extractRows(many, detectColumns(many))
    expect(byMerchant(out)[0].installment).toEqual({ index: 2, total: 3 })
  })

  /**
   * כך דיינרס מציג עסקת תשלומים: כל התשלומים באותו קובץ ובאותו
   * תאריך. אין כאן התחייבות עתידית, והחישוב הישן ניבא אחת.
   */
  it('כל התשלומים באותו תאריך פירושם שאין מה לצפות', () => {
    const together = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['31/03/2025', 'סקוט אייר', '255', 'תשלום 2 מתוך 2'],
      ['31/03/2025', 'סקוט אייר', '255', 'תשלום 1 מתוך 2'],
    ]
    const { rows: out } = extractRows(together, detectColumns(together))
    expect(installmentPlan(out)).toEqual({ count: 0, total: 0, byMonth: [] })
  })

  it('גם כששני התשלומים בסכומים שונים', () => {
    // אצל דיינרס תוכנית של שניים יכולה להתחלק 1 ו-11178
    const uneven = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['21/08/2025', 'וט המומחים', '11178', 'תשלום 2 מתוך 2'],
      ['21/08/2025', 'וט המומחים', '1', 'תשלום 1 מתוך 2'],
    ]
    const { rows: out } = extractRows(uneven, detectColumns(uneven))
    expect(installmentPlan(out).total).toBe(0)
  })

  it('שתי קניות נפרדות באותו עסק אינן מתערבבות', () => {
    const twice = [
      ['תאריך', 'שם בית עסק', 'סכום', 'הערות'],
      ['21/08/2025', 'וט המומחים', '500', 'תשלום 1 מתוך 2'],
      ['21/08/2025', 'וט המומחים', '500', 'תשלום 2 מתוך 2'],
      ['21/10/2025', 'וט המומחים', '600', 'תשלום 1 מתוך 2'],
    ]
    const { rows: out } = extractRows(twice, detectColumns(twice))
    // הראשונה הושלמה, השנייה עוד חייבת תשלום אחד
    expect(installmentPlan(out)).toEqual({
      count: 1, total: 600, byMonth: [{ month: '2025-11', amount: 600 }],
    })
  })
})

describe('ניחוש לפי ענף', () => {
  /**
   * שמות הענפים נלקחו מדוחות אשראי אמיתיים ולא נוחשו. הבדיקות כאן
   * נועלות את המלכודות שהתגלו כשעברנו על הדוחות.
   */
  const guess = async (sector) => {
    const { seedCategory } = await import('../src/lib/sectors')
    return seedCategory(sector)
  }

  it('מזון מהיר אינו קניות בסופר', async () => {
    // הסדר ברשימה הוא מה שמכריע: "מזון" היה תופס גם את "מזון מהיר"
    expect(await guess('מזון מהיר')).toBe('leisure')
    expect(await guess('מזון ומשקאות')).toBe('fixed')
  })

  it('דלק יושב תחת אנרגיה', async () => {
    expect(await guess('אנרגיה')).toBe('fixed')
    expect(await guess('רכב ותחבורה')).toBe('fixed')
  })

  it('ארנונה ומים מגיעים תחת מוסדות', async () => {
    expect(await guess('מוסדות')).toBe('fixed')
  })

  it('דמי כרטיס מגיעים תחת ציוד ומשרד', async () => {
    expect(await guess('ציוד ומשרד')).toBe('fixed')
  })

  it('חופשות הן הוצאה משתנה', async () => {
    expect(await guess('תיירות')).toBe('leisure')
    expect(await guess('מלונאות ואירוח')).toBe('leisure')
    expect(await guess('אירועים')).toBe('leisure')
  })

  it('ענף ריק לא מקבל הצעה', async () => {
    expect(await guess('')).toBe('')
    expect(await guess('ענף שלא מוכר')).toBe('')
  })
})

describe('חיובים חריגים', () => {
  /**
   * ענף לבדו לא מספיק: ניתוח דחוף לכלב וקופסת אקמול הם אותה "רפואה
   * ובריאות". הגודל ביחס לחודש הוא מה שמבדיל ביניהם.
   */
  const month = (extra = []) => {
    const small = Array.from({ length: 10 }, (_, index) => [
      `0${(index % 9) + 1}/04/2025`, `חנות ${index}`, '80', 'מזון ומשקאות',
    ])
    return [['תאריך', 'שם בית עסק', 'סכום', 'ענף'], ...small, ...extra]
  }

  it('חיוב גדול פי כמה מהחציון מסומן', () => {
    const rows = month([['21/04/2025', 'וט המומחים', '11178', 'רפואה ובריאות']])
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    const vet = groups.find((group) => group.name === 'וט המומחים')
    expect(vet.unusual).toHaveLength(1)
    expect(groups.filter((group) => group.unusual.length > 0)).toHaveLength(1)
  })

  it('החציון ולא הממוצע, אחרת החריג גורר את הסף אחריו', () => {
    // ממוצע של החודש הזה מעל 1000, וחיוב של 1200 היה נבלע בו
    const rows = month([
      ['21/04/2025', 'וט המומחים', '11178', 'רפואה ובריאות'],
      ['22/04/2025', 'עירית גבעתיים', '1312', 'מוסדות'],
    ])
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    expect(groups.filter((group) => group.unusual.length > 0)).toHaveLength(2)
  })

  it('יש רצפה, כדי שחודש של קניות קטנות לא יסמן הכל', () => {
    // חציון 80, ופי שישה הם 480, אבל 600 אינו אירוע חריג
    const rows = month([['21/04/2025', 'הום סנטר', '600', 'ריהוט ובית']])
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    expect(groups.every((group) => group.unusual.length === 0)).toBe(true)
  })

  it('קובץ קטן מדי לא מסמן כלום, כי אין ממה להסיק מה רגיל', () => {
    const rows = [
      ['תאריך', 'שם בית עסק', 'סכום', 'ענף'],
      ['21/04/2025', 'וט המומחים', '11178', 'רפואה ובריאות'],
      ['22/04/2025', 'שופרסל', '80', 'מזון ומשקאות'],
    ]
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    expect(groups.every((group) => group.unusual.length === 0)).toBe(true)
  })

  it('זיכוי אינו חיוב חריג', () => {
    const rows = month([['21/04/2025', 'AIRBNB', '-5493', 'תיירות']])
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    expect(groups.every((group) => group.unusual.length === 0)).toBe(true)
  })
})

describe('איחוד כמה קבצים', () => {
  /**
   * דוחות אשראי חופפים: תקופת החיוב חוצה חודשים, ולכן אותה עסקה
   * מופיעה בשני דוחות עוקבים.
   */
  const row = (date, name, amount) => ({ date, name, amount, month: date.slice(0, 7) })

  it('שורה שמופיעה בשני קבצים נספרת פעם אחת', async () => {
    const { mergeFiles } = await import('../src/lib/importRows')
    const first = [row('2025-03-31', 'שופרסל', 100), row('2025-04-01', 'WOLT', 50)]
    const second = [row('2025-04-01', 'WOLT', 50), row('2025-04-05', 'קפה', 20)]
    const { rows, duplicates } = mergeFiles([first, second])
    expect(rows).toHaveLength(3)
    expect(duplicates).toBe(1)
  })

  it('שתי קניות זהות באותו יום נשמרות, כי הן אמיתיות', async () => {
    const { mergeFiles } = await import('../src/lib/importRows')
    const twice = [row('2025-04-01', 'קפה', 20), row('2025-04-01', 'קפה', 20)]
    // אותו קובץ בדיוק, שהועלה פעמיים
    const { rows, duplicates } = mergeFiles([twice, twice])
    expect(rows).toHaveLength(2)
    expect(duplicates).toBe(2)
  })

  it('קובץ שמכיל יותר מופעים מנצח את זה שמכיל פחות', async () => {
    const { mergeFiles } = await import('../src/lib/importRows')
    const one = [row('2025-04-01', 'קפה', 20)]
    const two = [row('2025-04-01', 'קפה', 20), row('2025-04-01', 'קפה', 20)]
    expect(mergeFiles([one, two]).rows).toHaveLength(2)
    expect(mergeFiles([two, one]).rows).toHaveLength(2)
  })

  it('התוצאה ממוינת לפי תאריך', async () => {
    const { mergeFiles } = await import('../src/lib/importRows')
    const { rows } = mergeFiles([[row('2025-05-01', 'ב', 1)], [row('2025-04-01', 'א', 1)]])
    expect(rows.map((item) => item.name)).toEqual(['א', 'ב'])
  })

  it('קובץ אחד עובר כמו שהוא', async () => {
    const { mergeFiles } = await import('../src/lib/importRows')
    const only = [row('2025-04-01', 'קפה', 20)]
    expect(mergeFiles([only])).toEqual({ rows: only, duplicates: 0 })
  })
})

describe('כללים לפי שם בית עסק', () => {
  /**
   * הענף עונה על "איזה מין הוצאה זו", והשם עונה על "איזה עסק זה".
   * הכללים כאן נכתבו מול השמות כפי שהם באמת מופיעים בדוחות, ולא
   * כפי שהיינו מנחשים אותם.
   */
  const group = async (name) => {
    const { merchantGroup } = await import('../src/lib/merchants')
    return merchantGroup(name)
  }
  const category = async (name) => {
    const { merchantCategory } = await import('../src/lib/merchants')
    return merchantCategory(name)
  }

  it('כל הסופרים הם קבוצה אחת', async () => {
    for (const name of [
      'שופרסל שלי גבעתיים', 'שופרסל דיל מצפה רמון', 'אטליז גבעתיים',
      'קשת טעמים סניף עפולה', 'טיב טעם בן יהודה תל אביב', 'סופר יודה בע"מ',
      'מנו וינו רמב"ם', 'נאטסטיישן בע"מ', 'מ יוחננוף ובניו בעמ',
      'בי דראגסטור בלוך גבעתיים', 'AM PM אחד העם',
    ]) expect(await group(name)).toBe('סופר')
  })

  it('גם "אלמה מקרט", שכתוב בדוח בשגיאת כתיב', async () => {
    // התאמה על "אלמה מרקט" הייתה מחטיאה את כל השורות האלה
    expect(await group('אלמה מקרט')).toBe('סופר')
  })

  it('בית מרקחת הולך לסופר פארם ולא לסופר', async () => {
    expect(await group('סופר פארם גורדון תל אביב')).toBe('סופר פארם')
    expect(await group('בית מרקחת גן- העיר בע?מ')).toBe('סופר פארם')
  })

  it('דלק, מנטה ופז הם קבוצה אחת', async () => {
    expect(await group('דלק מנטה מחלף זיכרון יעקו')).toBe('דלק')
    expect(await group('דלק גל זרזיז')).toBe('דלק')
    expect(await group('פז YELLOW חופית')).toBe('דלק')
  })

  it('"פז" נבדק כמילה שלמה ולא כתת מחרוזת', async () => {
    // אחרת כל שם שיש בו את שני התווים האלה היה הופך לתחנת דלק
    expect(await group('חנות פזגז')).toBe('')
    expect(await group('מפזרים ותאורה')).toBe('')
  })

  it('עסק בלי כלל נשאר בשם שלו', async () => {
    expect(await group('קפה בליך')).toBe('')
    expect(await group('')).toBe('')
  })

  it('עלי אקספרס, ליים וטוקי הם הוצאה משתנה', async () => {
    expect(await category('aliexpress')).toBe('leisure')
    expect(await category('ALIEXPRESS.COM')).toBe('leisure')
    expect(await category('LIME*PASS BONP')).toBe('leisure')
    expect(await category('TUKI האיסים שלך בחו"ל')).toBe('leisure')
  })

  it('ליים ועלי אקספרס מתאחדים למרות השמות השונים', async () => {
    // קוד ההזמנה נכנס לשם בית העסק ומפצל אותו לשורות נפרדות
    for (const name of ['LIME*PASS BONP', 'LIME*RIDE BONP', 'LIME*2 RIDES BONP']) {
      expect(await group(name)).toBe('ליים')
    }
    expect(await group('aliexpress')).toBe('עלי אקספרס')
    expect(await group('ALIEXPRESS.COM')).toBe('עלי אקספרס')
  })

  it('והם נשארים הוצאה משתנה גם אחרי האיחוד', async () => {
    const { suggestCategory } = await import('../src/lib/sectors')
    const rows = [
      ['תאריך', 'שם בית עסק', 'סכום', 'ענף'],
      ['01/09/2026', 'LIME*PASS BONP', '45', 'רכב ותחבורה'],
      ['02/09/2026', 'LIME*RIDE BONP', '25', 'רכב ותחבורה'],
    ]
    const lime = byMerchant(extractRows(rows, detectColumns(rows)).rows)[0]
    expect(lime.name).toBe('ליים')
    expect(lime.rows).toHaveLength(2)
    expect(suggestCategory(lime).category).toBe('leisure')
  })

  it('סקוט אייר הוא תמיד בלת״ם', async () => {
    expect(await category('סקוט אייר')).toBe('unplanned')
  })

  it('הכלל לפי השם גובר על הענף ועל הוראת קבע', async () => {
    const { suggestCategory } = await import('../src/lib/sectors')
    // עלי אקספרס מגיע תחת "מזון ומשקאות", שהוא קבועות
    expect(suggestCategory({ sector: 'מזון ומשקאות', ruleCategory: 'leisure' }))
      .toEqual({ category: 'leisure', source: 'merchant' })
    expect(suggestCategory({ sector: 'רכב ותחבורה', type: 'הוראת קבע', ruleCategory: 'unplanned' }))
      .toEqual({ category: 'unplanned', source: 'merchant' })
  })

  it('הקיבוץ מגיע עד הקבוצה עצמה', () => {
    const rows = [
      ['תאריך', 'שם בית עסק', 'סכום', 'ענף'],
      ['01/09/2026', 'שופרסל שלי גבעתיים', '200', 'מזון ומשקאות'],
      ['02/09/2026', 'טיב טעם גבעתיים', '150', 'מזון ומשקאות'],
      ['03/09/2026', 'aliexpress', '30', 'מזון ומשקאות'],
    ]
    const groups = byMerchant(extractRows(rows, detectColumns(rows)).rows)
    const soup = groups.find((item) => item.name === 'סופר')
    expect(soup.rows).toHaveLength(2)
    expect(soup.total).toBe(350)
    // השם המקורי נשמר על השורה, כדי שהפתיחה תראה את הסניף
    expect(soup.rows.map((row) => row.name)).toEqual(['שופרסל שלי גבעתיים', 'טיב טעם גבעתיים'])
    expect(groups.find((item) => item.name === 'עלי אקספרס').ruleCategory).toBe('leisure')
  })
})

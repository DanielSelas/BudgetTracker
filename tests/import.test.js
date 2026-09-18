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
  byMerchant, detectColumns, extractRows, findHeaderRow, parseAmount, parseDate,
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
    expect(groups.map((group) => group.name)).toEqual(['שופרסל דיל', 'פז יעלים', 'זיכוי'])
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

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

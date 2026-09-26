import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * הגדרת האחסון נבדקת כאן כי היא נכשלת רק על השרת.
 *
 * הבילד המקומי עובר בלי לגעת בקובץ הזה, ולכן טעות בו מתגלה רק
 * כשהפריסה נכשלת, והאפליקציה נשארת בגרסה קודמת בלי שאיש שם לב.
 * זה בדיוק מה שקרה כשהוספתי מפתח "//" כהערה: ל-JSON אין הערות.
 */
const config = JSON.parse(readFileSync('vercel.json', 'utf8'))

const REWRITE_KEYS = ['source', 'destination', 'permanent', 'has', 'missing', 'statusCode']
const HEADER_KEYS = ['source', 'headers', 'has', 'missing']

describe('vercel.json', () => {
  it('לכללי הניתוב יש רק מפתחות מוכרים', () => {
    for (const rule of config.rewrites || []) {
      expect(Object.keys(rule).filter((key) => !REWRITE_KEYS.includes(key))).toEqual([])
    }
  })

  it('ולכללי הכותרות', () => {
    for (const rule of config.headers || []) {
      expect(Object.keys(rule).filter((key) => !HEADER_KEYS.includes(key))).toEqual([])
    }
  })

  it('כל נתיב מגיע ל-index.html חוץ מהקבצים עצמם', () => {
    const [rule] = config.rewrites
    const pattern = new RegExp(`^${rule.source}$`)
    expect(pattern.test('/')).toBe(true)
    expect(pattern.test('/some/deep/route')).toBe(true)
    // קובץ שנמחק בפריסה חדשה צריך להחזיר 404 ולא דף HTML שמתחזה לקוד
    expect(pattern.test('/assets/index-abc123.js')).toBe(false)
  })

  /**
   * פונקציית השרת חייבת להישאר מחוץ לניתוב. בלי ההחרגה הקריאה
   * ליועץ הייתה מקבלת את index.html במקום תשובה, וזה נראה כמו
   * שגיאת פענוח ולא כמו ניתוב שגוי.
   */
  it('הנקודה של היועץ אינה נבלעת בניתוב', () => {
    const [rule] = config.rewrites
    const pattern = new RegExp(`^${rule.source}$`)
    expect(pattern.test('/api/chat')).toBe(false)
  })
})

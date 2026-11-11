import { describe, expect, it } from 'vitest'
import { parseCapture, suggestForCapture } from '../src/lib/capture.js'
import { captureId } from '../src/lib/inbox.js'

describe('parseCapture', () => {
  it('ספרות ושם, בכל סדר', () => {
    expect(parseCapture('50 סופר')).toEqual({ amount: 50, name: 'סופר' })
    expect(parseCapture('סופר 50')).toEqual({ amount: 50, name: 'סופר' })
    expect(parseCapture('שילמתי 50 בסופר')).toEqual({ amount: 50, name: 'שילמתי בסופר' })
  })

  it('מילות מטבע אינן חלק מהשם', () => {
    expect(parseCapture('50 שקל סופר')).toEqual({ amount: 50, name: 'סופר' })
    expect(parseCapture('50₪ שופרסל')).toEqual({ amount: 50, name: 'שופרסל' })
    expect(parseCapture('30 ש״ח דלק')).toEqual({ amount: 30, name: 'דלק' })
  })

  it('מפריד אלפים ונקודה עשרונית', () => {
    expect(parseCapture('1,250 ביטוח')).toEqual({ amount: 1250, name: 'ביטוח' })
    expect(parseCapture('12.90 קפה')).toEqual({ amount: 12.9, name: 'קפה' })
  })

  it('מילות מספר, כי הכתבה קולית לא תמיד נותנת ספרות', () => {
    expect(parseCapture('חמישים שקל סופר')).toEqual({ amount: 50, name: 'סופר' })
    expect(parseCapture('עשרים ושלוש מסעדה')).toEqual({ amount: 23, name: 'מסעדה' })
    expect(parseCapture('מאה חמישים דלק')).toEqual({ amount: 150, name: 'דלק' })
    expect(parseCapture('חמש מאות ביטוח')).toEqual({ amount: 500, name: 'ביטוח' })
    expect(parseCapture('אלף מאתיים שכירות')).toEqual({ amount: 1200, name: 'שכירות' })
    expect(parseCapture('שלושת אלפים הלוואה')).toEqual({ amount: 3000, name: 'הלוואה' })
    expect(parseCapture('חמש עשרה חניה')).toEqual({ amount: 15, name: 'חניה' })
  })

  it('ספרות גוברות על מילים, כדי שבית עסק ששמו מספר לא ייבלע', () => {
    expect(parseCapture('80 שבע')).toEqual({ amount: 80, name: 'שבע' })
  })

  it('קליטה חלקית מוחזרת כמו שהיא ולא נזרקת', () => {
    expect(parseCapture('סופר')).toEqual({ amount: 0, name: 'סופר' })
    expect(parseCapture('50')).toEqual({ amount: 50, name: '' })
    expect(parseCapture('')).toEqual({ amount: 0, name: '' })
    expect(parseCapture(null)).toEqual({ amount: 0, name: '' })
  })
})

describe('captureId', () => {
  it('נגזר מהתוכן, ולכן רענון של אותו קישור אינו מוסיף שורה שנייה', () => {
    const once = captureId({ date: '2026-11-11', name: 'סופר', amount: 50 })
    const twice = captureId({ date: '2026-11-11', name: 'סופר', amount: 50 })
    expect(once).toBe(twice)
  })

  it('סכום אחר או יום אחר הם שורה אחרת', () => {
    const base = captureId({ date: '2026-11-11', name: 'סופר', amount: 50 })
    expect(captureId({ date: '2026-11-11', name: 'סופר', amount: 51 })).not.toBe(base)
    expect(captureId({ date: '2026-11-12', name: 'סופר', amount: 50 })).not.toBe(base)
  })
})

describe('suggestForCapture', () => {
  it('כלל לפי שם בית עסק גובר', () => {
    expect(suggestForCapture('aliexpress')).toMatchObject({
      category: 'leisure',
      source: 'merchant',
    })
  })

  it('הקבוצה נגזרת מהשם גם בלי היסטוריה', () => {
    expect(suggestForCapture('שופרסל דיל').groupKey).toBe('סופר')
  })

  it('לומד ממה שכבר סווג באותה קבוצה', () => {
    const entries = [
      { name: 'שופרסל', groupKey: 'סופר', category: 'fixed' },
      { name: 'יוחננוף', groupKey: 'סופר', category: 'fixed' },
    ]
    expect(suggestForCapture('טיב טעם', entries)).toMatchObject({
      category: 'fixed',
      groupKey: 'סופר',
      source: 'history',
    })
  })

  it('בלי קבוצה, לפי השם עצמו', () => {
    const entries = [{ name: 'ארנונה', category: 'fixed' }]
    expect(suggestForCapture('ארנונה', entries)).toMatchObject({
      category: 'fixed',
      source: 'history',
    })
  })

  it('הכנסה אינה ראיה: שם שמתנגש במשכורת אינו מסווג כהכנסה', () => {
    const entries = [{ name: 'סופר', category: 'income' }]
    expect(suggestForCapture('סופר', entries).category).toBe('')
  })

  it('בלי התאמה מחזיר ריק ולא ניחוש', () => {
    expect(suggestForCapture('חנות שלא הייתי בה', []).category).toBe('')
  })
})

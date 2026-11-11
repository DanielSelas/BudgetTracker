import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'

import { dayMonth, stampDay } from '../src/lib/format'

describe('dayMonth', () => {
  it('מוריד את השנה ואת האפסים המובילים', () => {
    expect(dayMonth('2026-09-03')).toBe('3.9')
    expect(dayMonth('2026-11-11')).toBe('11.11')
  })

  it('תאריך חסר אינו תאריך', () => {
    expect(dayMonth('')).toBe('')
    expect(dayMonth(undefined)).toBe('')
    expect(dayMonth('2026-09')).toBe('')
  })
})

describe('stampDay', () => {
  it('קורא חותמת של Firestore', () => {
    const stamp = Timestamp.fromDate(new Date(2026, 8, 3, 14, 30))
    expect(stampDay(stamp)).toBe('3.9')
  })

  it('וגם תאריך רגיל, כי הבדיקות עובדות בלי שרת', () => {
    expect(stampDay(new Date(2026, 10, 11))).toBe('11.11')
  })

  /**
   * המקרה שבאמת קורה: serverTimestamp נפתר בשרת, ועד שהתשובה חוזרת
   * המאזין המקומי מחזיר את הרשומה כשהשדה ריק
   */
  it('כתיבה שטרם אושרה אינה שגיאה', () => {
    expect(stampDay(null)).toBe('')
    expect(stampDay(undefined)).toBe('')
    expect(stampDay(new Date('לא תאריך'))).toBe('')
  })
})

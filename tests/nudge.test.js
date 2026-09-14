import { describe, expect, it, vi } from 'vitest'
import { monthContext, nudgeFor } from '../scripts/month-end-nudge.mjs'

// כל הזמנים ב-UTC. ישראל היא UTC+2 בחורף ו-UTC+3 בקיץ.
const at = (iso) => new Date(iso)

describe('monthContext', () => {
  it('מזהה את היום האחרון בחודש לפי שעון ישראל', () => {
    expect(monthContext(at('2026-01-31T21:00:00Z'))).toEqual({ month: '2026-01', isLastDay: true })
  })

  it('לא מזהה יום רגיל כאחרון', () => {
    expect(monthContext(at('2026-01-15T12:00:00Z'))).toEqual({ month: '2026-01', isLastDay: false })
    expect(monthContext(at('2026-01-30T12:00:00Z'))).toEqual({ month: '2026-01', isLastDay: false })
  })

  it('חוצה את קו אזור הזמן נכון', () => {
    // 22:30 UTC ב-31 בינואר הוא כבר 00:30 ב-1 בפברואר בישראל
    expect(monthContext(at('2026-01-31T22:30:00Z'))).toEqual({ month: '2026-02', isLastDay: false })
  })

  it('עובד בחודש קצר ובשנה מעוברת', () => {
    expect(monthContext(at('2026-02-28T12:00:00Z')).isLastDay).toBe(true)
    expect(monthContext(at('2024-02-28T12:00:00Z')).isLastDay).toBe(false)
    expect(monthContext(at('2024-02-29T12:00:00Z')).isLastDay).toBe(true)
  })

  it('עובד במעבר שנה', () => {
    expect(monthContext(at('2026-12-31T12:00:00Z'))).toEqual({ month: '2026-12', isLastDay: true })
    expect(monthContext(at('2027-01-01T12:00:00Z'))).toEqual({ month: '2027-01', isLastDay: false })
  })

  it('עובד גם בשעון קיץ', () => {
    expect(monthContext(at('2026-07-31T20:00:00Z')).isLastDay).toBe(true)
    expect(monthContext(at('2026-07-31T21:30:00Z'))).toEqual({ month: '2026-08', isLastDay: false })
  })
})

describe('nudgeFor', () => {
  const budget = { id: 'b1', name: 'משק הבית' }
  const summary = { balance: 1240 }

  it('פונה בשם כשיש שם', () => {
    const nudge = nudgeFor({ member: { displayName: 'דניאל' }, budget, summary })
    expect(nudge.body).toContain('היי דניאל')
    expect(nudge.body).toContain('משק הבית')
    expect(nudge.title).toContain('1,240')
  })

  it('מסתדר גם בלי שם', () => {
    const nudge = nudgeFor({ member: {}, budget, summary })
    expect(nudge.body).not.toContain('undefined')
    expect(nudge.body.startsWith('זה מה שלא הוצא')).toBe(true)
  })

  it('הקישור פותח הפקדה לקרן עם הסכום', () => {
    const nudge = nudgeFor({ member: { displayName: 'נועה' }, budget, summary })
    expect(nudge.link).toBe('/?nudge=fund&budget=b1&amount=1240')
  })
})

describe('קריאת הקישור מההתראה', () => {
  async function readFrom(search) {
    vi.resetModules()
    const original = window.location
    delete window.location
    window.location = { search, pathname: '/' }
    const { readNudge } = await import('../src/lib/deepLink.js')
    const result = readNudge()
    window.location = original
    return result
  }

  it('קורא קטגוריה, תקציב וסכום', async () => {
    expect(await readFrom('?nudge=fund&budget=b1&amount=1240')).toEqual({
      budgetId: 'b1', category: 'fund', amount: 1240,
    })
  })

  it('מתעלם מכתובת בלי פרמטר', async () => {
    expect(await readFrom('')).toBeNull()
    expect(await readFrom('?other=1')).toBeNull()
  })

  it('דוחה סכום לא תקין במקום להעביר אותו לטופס', async () => {
    expect((await readFrom('?nudge=fund&budget=b1&amount=abc')).amount).toBe(0)
    expect((await readFrom('?nudge=fund&budget=b1&amount=-5')).amount).toBe(0)
  })
})

describe('הודעה על חריגה', () => {
  const member = { displayName: 'דניאל' }
  const budget = { id: 'b1', name: 'משק הבית' }

  it('יתרה שלילית מדווחת כחריגה, ואומרת איפה', async () => {
    const { nudgeFor } = await import('../scripts/month-end-nudge.mjs')
    const payload = nudgeFor({
      member,
      budget,
      summary: {
        balance: -1200,
        groups: { leisure: { target: 6000, deviation: 900 }, fixed: { target: 10000, deviation: 200 } },
      },
    })
    expect(payload.title).toContain('חריגה')
    expect(payload.body).toContain('פנאי')
    expect(payload.link).toContain('nudge=review')
  })

  it('בתוך ההכנסות אבל מעל היעד, ההודעה מבחינה בין השניים', async () => {
    const { nudgeFor } = await import('../scripts/month-end-nudge.mjs')
    const payload = nudgeFor({
      member,
      budget,
      summary: { balance: 800, groups: { fixed: { target: 10000, deviation: 1500 } } },
    })
    expect(payload.title).toContain('קבועות')
    expect(payload.body).toContain('נשארתם בתוך ההכנסות')
  })

  it('חודש נקי ממשיך להציע הפקדה לקרן', async () => {
    const { nudgeFor } = await import('../scripts/month-end-nudge.mjs')
    const payload = nudgeFor({
      member,
      budget,
      summary: { balance: 3200, groups: { fixed: { target: 10000, deviation: -500 } } },
    })
    expect(payload.title).toContain('נשאר לכם')
    expect(payload.link).toContain('nudge=fund')
  })
})

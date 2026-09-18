import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  arrayUnion: (...values) => ({ values }),
  doc: () => ({}),
  collection: () => ({}),
  writeBatch: () => ({ delete: () => {}, update: () => {}, commit: async () => {} }),
}))

const { cleanupPlan, skipsFor } = await import('../src/lib/cleanup')

/**
 * הסיווג השתנה, והיסטוריה שכבר לא נכונה נמחקת במקום לתקן אותה שורה
 * אחר שורה. מה שנמחק נראה במסך לפני שהוא נמחק, ולכן התוכנית נבדקת
 * בנפרד מהמחיקה.
 */
const entries = [
  { id: 'a', month: '2026-07', category: 'fixed', actualAmount: 100 },
  { id: 'b', month: '2026-08', category: 'leisure', actualAmount: 50 },
  { id: 'c', month: '2026-08', category: 'income', actualAmount: 20000 },
  { id: 'd', month: '2026-09', category: 'fixed', actualAmount: 300 },
  { id: 'e', month: '2026-10', category: 'fixed', actualAmount: 400 },
]

describe('ניקוי רשומות', () => {
  it('חודש הגבול עצמו נשאר, וגם מה שאחריו', () => {
    const plan = cleanupPlan(entries, { before: '2026-09' })
    expect(plan.doomed.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(plan.kept).toBe(3)
  })

  it('הכנסות נשמרות גם בחודשים שנמחקים', () => {
    const plan = cleanupPlan(entries, { before: '2026-09', keepIncome: true })
    expect(plan.doomed.map((entry) => entry.id)).not.toContain('c')
    expect(plan.keptIncome).toBe(1)
  })

  it('ואפשר גם למחוק אותן', () => {
    const plan = cleanupPlan(entries, { before: '2026-09', keepIncome: false })
    expect(plan.doomed.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('הפירוט לפי חודש הוא מה שמוצג לפני המחיקה', () => {
    const plan = cleanupPlan(entries, { before: '2026-09' })
    expect(plan.months).toEqual([
      { month: '2026-07', count: 1, total: 100 },
      { month: '2026-08', count: 1, total: 50 },
    ])
  })

  it('בלי חודש גבול לא נמחק כלום', () => {
    expect(cleanupPlan(entries, { before: '' }).doomed).toEqual([])
  })

  /**
   * בלי הדילוגים המחיקה מתבטלת מעצמה: פתיחת החודש שנמחק יוצרת מחדש
   * את השורות של כל חיוב קבוע שחל בו.
   */
  it('רק החודשים שבהם באמת הייתה שורה מסומנים לדילוג', () => {
    const doomed = [
      { id: 'a', month: '2026-07', recurringId: 'rent' },
      { id: 'b', month: '2026-08', recurringId: 'rent' },
      { id: 'c', month: '2026-08', recurringId: 'arnona' },
      { id: 'd', month: '2026-08' },
    ]
    const skips = skipsFor(doomed)
    expect([...skips.get('rent')]).toEqual(['2026-07', '2026-08'])
    expect([...skips.get('arnona')]).toEqual(['2026-08'])
    expect(skips.size).toBe(2)
  })
})

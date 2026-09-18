import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * מחיקה מלאה של חיוב קבוע.
 *
 * הסדר כאן אינו פרט טכני. אם השורות נמחקות לפני התבנית, נפתח חלון
 * שבו התבנית פעילה ולחודש הפתוח אין שורה, וזה בדיוק התנאי שגורם
 * ליצירה אוטומטית מחדש. השורה חוזרת, הסכום לא משתנה, והמחיקה
 * נראית כאילו לא קרתה.
 */
const calls = []

vi.mock('../src/lib/firebase', () => ({ db: {} }))
vi.mock('../src/lib/paths', () => ({
  entriesRef: () => ({ kind: 'entries' }),
  entryRef: (_budget, id) => ({ kind: 'entry', id }),
  recurringId: () => 'x',
}))
vi.mock('firebase/firestore', () => ({
  collection: () => ({ kind: 'templates' }),
  doc: (_ref, id) => ({ kind: 'template', id }),
  deleteDoc: async (ref) => { calls.push(['deleteTemplate', ref.id]) },
  getDocs: async () => ({
    size: 2,
    docs: [
      { id: 'r__2026-08', data: () => ({ month: '2026-08' }) },
      { id: 'r__2026-09', data: () => ({ month: '2026-09' }) },
    ],
  }),
  query: (ref) => ref,
  where: () => ({}),
  writeBatch: () => ({
    delete: (ref) => { calls.push(['deleteEntry', ref.id]) },
    commit: async () => { calls.push(['commit']) },
  }),
  arrayUnion: () => null,
  serverTimestamp: () => null,
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteField: () => null,
  onSnapshot: () => () => {},
}))

const { countTemplateEntries, deleteTemplateEverywhere, stopTemplate } =
  await import('../src/lib/recurring')

beforeEach(() => { calls.length = 0 })

describe('מחיקת חיוב קבוע', () => {
  it('התבנית נמחקת ראשונה, ורק אחריה השורות', async () => {
    const result = await deleteTemplateEverywhere('b1', 'fixed-שכר-דירה')
    expect(calls[0]).toEqual(['deleteTemplate', 'fixed-שכר-דירה'])
    expect(calls.slice(1)).toEqual([
      ['deleteEntry', 'r__2026-08'],
      ['deleteEntry', 'r__2026-09'],
      ['commit'],
    ])
    expect(result.removed).toBe(2)
  })

  it('מזהה חסר זורק במקום להיכשל בשקט', async () => {
    await expect(deleteTemplateEverywhere('b1', '')).rejects.toThrow()
    expect(() => stopTemplate('b1', undefined)).toThrow()
    expect(calls).toEqual([])
  })

  it('הספירה אומרת כמה שורות ובכמה חודשים', async () => {
    expect(await countTemplateEntries('b1', 'r')).toEqual({ rows: 2, months: 2 })
    expect(await countTemplateEntries('b1', '')).toEqual({ rows: 0, months: 0 })
  })
})

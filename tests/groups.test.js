import { describe, expect, it } from 'vitest'
import { groupEntries, normalizeGroup, usedGroups } from '../src/lib/groups'

const entry = (id, actualAmount, groupKey) => ({ id, actualAmount, groupKey, name: id })

describe('normalizeGroup', () => {
  it('מנקה רווחים ומתעלם מערך חסר', () => {
    expect(normalizeGroup('  סופר  ')).toBe('סופר')
    expect(normalizeGroup(undefined)).toBe('')
    expect(normalizeGroup('   ')).toBe('')
  })

  it('חותך שם ארוך מדי, כמו הכלל בצד השרת', () => {
    expect(normalizeGroup('א'.repeat(60))).toHaveLength(40)
  })
})

describe('groupEntries', () => {
  it('שורה בלי קיבוץ נשארת שורה', () => {
    const items = groupEntries([entry('a', 100), entry('b', 50)])
    expect(items.map((item) => item.kind)).toEqual(['entry', 'entry'])
  })

  it('מאחד שורות עם אותו שם וסוכם אותן', () => {
    const items = groupEntries([
      entry('a', 300, 'קניות בסופר'),
      entry('b', 12, 'קניות בסופר'),
      entry('c', 90, 'קניות בסופר'),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('group')
    expect(items[0].total).toBe(402)
    expect(items[0].entries).toHaveLength(3)
  })

  it('שומר על סדר ההופעה ומערבב קבוצות ושורות', () => {
    const items = groupEntries([
      entry('a', 100),
      entry('b', 200, 'סופר'),
      entry('c', 300),
      entry('d', 50, 'סופר'),
      entry('e', 80, 'דלק'),
    ])
    expect(items.map((item) => item.id)).toEqual(['a', 'group:סופר', 'c', 'group:דלק'])
    expect(items[1].total).toBe(250)
  })

  it('רווחים מיותרים לא פותחים קבוצה שנייה', () => {
    const items = groupEntries([entry('a', 10, 'סופר'), entry('b', 20, ' סופר ')])
    expect(items).toHaveLength(1)
    expect(items[0].total).toBe(30)
  })

  it('קבוצה עם שורה אחת נשארת קבוצה', () => {
    const items = groupEntries([entry('a', 10, 'סופר')])
    expect(items[0].kind).toBe('group')
  })

  it('סכום חסר נספר כאפס', () => {
    expect(groupEntries([entry('a', undefined, 'סופר')])[0].total).toBe(0)
  })
})

describe('usedGroups', () => {
  it('מחזיר כל שם פעם אחת, לפי סדר ההופעה', () => {
    expect(usedGroups([
      entry('a', 1, 'סופר'),
      entry('b', 1),
      entry('c', 1, 'דלק'),
      entry('d', 1, 'סופר'),
    ])).toEqual(['סופר', 'דלק'])
  })

  it('בלי קיבוצים מחזיר רשימה ריקה', () => {
    expect(usedGroups([entry('a', 1)])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  MAX_REMEMBERED_GROUPS, groupEntries, groupOptions, normalizeGroup, usedGroups, withRemembered,
} from '../src/lib/groups'

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

describe('קבוצות לצירוף', () => {
  const rows = [
    { groupKey: 'סופר', category: 'fixed', actualAmount: 1240 },
    { groupKey: 'סופר', category: 'fixed', actualAmount: 38 },
    { groupKey: 'דלק', category: 'fixed', actualAmount: 300 },
    { category: 'leisure', actualAmount: 90 },
  ]

  it('סכום וקטגוריה לכל קבוצה, בלי שורות שאינן מקובצות', () => {
    expect(groupOptions(rows)).toEqual([
      { key: 'סופר', total: 1278, category: 'fixed' },
      { key: 'דלק', total: 300, category: 'fixed' },
    ])
  })

  it('ממוין לפי סכום: מה שגדול הוא מה שמצרפים אליו', () => {
    const [first] = groupOptions([
      { groupKey: 'קפה', category: 'leisure', actualAmount: 18 },
      { groupKey: 'סופר', category: 'fixed', actualAmount: 900 },
    ])
    expect(first.key).toBe('סופר')
  })

  it('קבוצה מעורבת מקבלת את הקטגוריה הנפוצה בה', () => {
    const [group] = groupOptions([
      { groupKey: 'שונות', category: 'leisure', actualAmount: 10 },
      { groupKey: 'שונות', category: 'fixed', actualAmount: 10 },
      { groupKey: 'שונות', category: 'fixed', actualAmount: 10 },
    ])
    expect(group.category).toBe('fixed')
  })

  it('בלי רשומות מחזיר רשימה ריקה ולא נופל', () => {
    expect(groupOptions()).toEqual([])
  })
})


/**
 * קבוצה היא תווית שנפתחה בכוונה, ולכן היא שורדת מעבר חודש. בלי
 * הזכירה הזו ה"סופר" של אוקטובר נעלם ב-1 בנובמבר
 */
describe('קבוצות שנשמרות מחודש לחודש', () => {
  it('שם חדש נוסף לסוף הרשימה', () => {
    expect(withRemembered(['דלק'], ['סופר'])).toEqual(['דלק', 'סופר'])
  })

  // חודש שלם נקרא בבת אחת, ולכן כמה שמות בכתיבה אחת
  it('כמה שמות נכנסים יחד, בלי כפילות ביניהם', () => {
    expect(withRemembered(['דלק'], ['סופר', 'דלק', 'סופר', 'חניה']))
      .toEqual(['דלק', 'סופר', 'חניה'])
  })

  /**
   * null הוא מה שעוצר את הלולאה: הכתיבה משנה את מסמך התקציב, המסמך
   * מפעיל מחדש את מי שקרא לכאן, ובפעם השנייה אין מה להוסיף
   */
  it('כשאין מה להוסיף אין כתיבה', () => {
    expect(withRemembered(['סופר', 'דלק'], ['סופר'])).toBeNull()
    expect(withRemembered(['סופר'], ['  סופר  '])).toBeNull()
    expect(withRemembered(['סופר'], [])).toBeNull()
    expect(withRemembered(['סופר'], ['', undefined])).toBeNull()
  })

  it('כשהרשימה מתמלאת הוותיק יוצא', () => {
    const full = Array.from({ length: MAX_REMEMBERED_GROUPS }, (_, index) => `ק${index}`)
    const next = withRemembered(full, ['חדש'])
    expect(next).toHaveLength(MAX_REMEMBERED_GROUPS)
    expect(next[0]).toBe('ק1')
    expect(next.at(-1)).toBe('חדש')
  })

  it('הצעות ההזנה מחברות את החודש ואת מה שנשמר, בלי כפילות', () => {
    const entries = [entry('a', 100, 'סופר')]
    expect(usedGroups(entries, ['סופר', 'דלק'])).toEqual(['סופר', 'דלק'])
  })

  it('קבוצה שנשמרה ואין לה שורה החודש נכנסת בסוף, בלי סכום', () => {
    const options = groupOptions([entry('a', 100, 'סופר')], ['סופר', 'בית מרקחת'])
    expect(options.map((option) => option.key)).toEqual(['סופר', 'בית מרקחת'])
    expect(options[1]).toEqual({ key: 'בית מרקחת', total: 0, category: '' })
  })

  /**
   * קטגוריה ריקה ולא מה שסווג שם בעבר: הקטגוריה תיקבע מהניחוש לפי
   * בית העסק או מבחירה, ולא מהיסטוריית הסיווג של המשתמש
   */
  it('הקבוצה שנשמרה מציעה שם ולא קטגוריה', () => {
    const [option] = groupOptions([], ['סופר'])
    expect(option.category).toBe('')
  })
})

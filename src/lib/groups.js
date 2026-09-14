/**
 * קיבוץ רשומות בתוך קטגוריה. דברים כמו קניות בסופר קורים כמה פעמים
 * בחודש, ובלי קיבוץ הם מציפים את הכרטיס ומסתירים את שאר ההוצאות.
 *
 * הקיבוץ הוא שדה חופשי ולא קטגוריה חדשה, כדי שאותו מנגנון ישרת גם
 * דלק, בית מרקחת וכל דבר אחר שחוזר, בלי להוסיף קטגוריות למודל.
 */

export const MAX_GROUP_LENGTH = 40

/** הצעות פתיחה למי שעוד לא יצר קבוצה משלו. */
export const SUGGESTED_GROUPS = ['קניות בסופר', 'דלק', 'בית מרקחת']

export const normalizeGroup = (raw) => (raw || '').trim().slice(0, MAX_GROUP_LENGTH)

/**
 * מחזיר רשימה מעורבת של שורות בודדות וקבוצות, לפי סדר ההופעה המקורי.
 * קבוצה עם שורה אחת נשארת קבוצה: היא נפתחה בכוונה, והיעלמות שלה
 * ברגע שמוחקים שורה הייתה נראית כמו תקלה.
 */
export function groupEntries(entries = []) {
  const items = []
  const byKey = new Map()

  for (const entry of entries) {
    const key = normalizeGroup(entry.groupKey)
    if (!key) {
      items.push({ kind: 'entry', id: entry.id, entry })
      continue
    }

    const existing = byKey.get(key)
    if (existing) {
      existing.entries.push(entry)
      existing.total += entry.actualAmount || 0
      continue
    }

    const group = {
      kind: 'group',
      id: `group:${key}`,
      key,
      entries: [entry],
      total: entry.actualAmount || 0,
    }
    byKey.set(key, group)
    items.push(group)
  }

  return items
}

/** שמות הקבוצות שכבר בשימוש החודש, להצעה מהירה במגירת ההזנה. */
export function usedGroups(entries = []) {
  const seen = []
  for (const entry of entries) {
    const key = normalizeGroup(entry.groupKey)
    if (key && !seen.includes(key)) seen.push(key)
  }
  return seen
}

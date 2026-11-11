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

/**
 * הקבוצות שכבר בשימוש, עם הקטגוריה והסכום של כל אחת.
 *
 * זה מה שצריך כדי לשייך הוצאה שנקלטה לחיוב קיים: לא רק השם, אלא גם
 * כמה כבר יש שם וללאן זה נספר. "סופר, 1,240 ש״ח, קבועות" אומר למה
 * מצרפים, ושם לבדו לא.
 *
 * ממוין לפי סכום ולא לפי אלפבית, כי מה שגדול הוא גם מה שמצרפים
 * אליו: החיוב שחוזר שבוע אחרי שבוע הוא הראשון ברשימה.
 */
export function groupOptions(entries = []) {
  const byKey = new Map()

  for (const entry of entries) {
    const key = normalizeGroup(entry.groupKey)
    if (!key) continue
    const current = byKey.get(key) || { key, total: 0, counts: new Map() }
    current.total += entry.actualAmount || 0
    current.counts.set(entry.category, (current.counts.get(entry.category) || 0) + 1)
    byKey.set(key, current)
  }

  return [...byKey.values()]
    .map(({ key, total, counts }) => ({
      key,
      total,
      // הקטגוריה הנפוצה בקבוצה. קבוצה מעורבת היא נדירה, ואז הרוב
      // הוא הניחוש הסביר ביותר
      category: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.total - a.total)
}

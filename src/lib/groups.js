/**
 * קיבוץ רשומות בתוך קטגוריה. דברים כמו קניות בסופר קורים כמה פעמים
 * בחודש, ובלי קיבוץ הם מציפים את הכרטיס ומסתירים את שאר ההוצאות.
 *
 * הקיבוץ הוא שדה חופשי ולא קטגוריה חדשה, כדי שאותו מנגנון ישרת גם
 * דלק, בית מרקחת וכל דבר אחר שחוזר, בלי להוסיף קטגוריות למודל.
 */

export const MAX_GROUP_LENGTH = 40

/**
 * כמה שמות קבוצה נשמרים על התקציב.
 *
 * הרשימה יושבת על מסמך התקציב ולא נגזרת מהרשומות, וזו בדיוק הנקודה:
 * קבוצה היא תווית שנפתחה בכוונה, ולכן היא שורדת מעבר חודש. בלי זה
 * ה"סופר" של אוקטובר נעלם ב-1 בנובמבר ונפתח מחדש בהקלדה.
 *
 * ותקרה, כי זהו שדה שכל חבר יכול לכתוב אליו: כשהיא מתמלאת הוותיק
 * ביותר יוצא, וכך הרשימה נשארת מה שבאמת בשימוש
 */
export const MAX_REMEMBERED_GROUPS = 30

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

/**
 * הרשימה המעודכנת של שמות שנשמרים, או null כשאין מה לשנות.
 *
 * null ולא הרשימה עצמה, כדי שהקורא ידע לדלג על הכתיבה. בדרך כלל אין
 * מה להוסיף, ולכתוב את אותו מסמך בכל פתיחת חודש זה סיבוב רשת על לא
 * כלום. ובלי ה-null גם הייתה לולאה: הכתיבה משנה את המסמך, והמסמך
 * מפעיל מחדש את מי שקרא לכאן.
 *
 * מקבל רשימה ולא שם בודד, כי חודש שלם נקרא בבת אחת.
 */
export function withRemembered(names = [], keys = []) {
  const list = Array.isArray(keys) ? keys : [keys]
  const added = []
  for (const key of list) {
    const clean = normalizeGroup(key)
    if (!clean) continue
    if (names.includes(clean) || added.includes(clean)) continue
    added.push(clean)
  }
  if (added.length === 0) return null
  // החדשים נכנסים בסוף, והוותיקים יוצאים בראש
  return [...names, ...added].slice(-MAX_REMEMBERED_GROUPS)
}

/**
 * שמות הקבוצות להצעה מהירה במגירת ההזנה.
 *
 * מה שבשימוש החודש קודם, ואחריו מה שנשמר מחודשים שעברו: הקבוצה
 * שכבר פתוחה עכשיו היא הסבירה יותר, אבל גם זו משלשום ראויה לנגיעה
 * במקום להקלדה.
 */
export function usedGroups(entries = [], remembered = []) {
  const seen = []
  for (const entry of entries) {
    const key = normalizeGroup(entry.groupKey)
    if (key && !seen.includes(key)) seen.push(key)
  }
  for (const name of remembered) {
    const key = normalizeGroup(name)
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
 *
 * קבוצה שנשמרה מחודש שעבר ועוד אין לה שורה החודש נכנסת בסוף, בלי
 * סכום ובלי קטגוריה. היא מוצעת כשם בלבד: הקטגוריה תיקבע מהניחוש
 * לפי בית העסק או מבחירה, ולא ממה שסווג שם בעבר.
 */
export function groupOptions(entries = [], remembered = []) {
  const byKey = new Map()

  for (const entry of entries) {
    const key = normalizeGroup(entry.groupKey)
    if (!key) continue
    const current = byKey.get(key) || { key, total: 0, counts: new Map() }
    current.total += entry.actualAmount || 0
    current.counts.set(entry.category, (current.counts.get(entry.category) || 0) + 1)
    byKey.set(key, current)
  }

  const open = [...byKey.values()]
    .map(({ key, total, counts }) => ({
      key,
      total,
      // הקטגוריה הנפוצה בקבוצה. קבוצה מעורבת היא נדירה, ואז הרוב
      // הוא הניחוש הסביר ביותר
      category: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.total - a.total)

  const waiting = remembered
    .map((name) => normalizeGroup(name))
    .filter((key) => key && !byKey.has(key))
    .map((key) => ({ key, total: 0, category: '' }))

  return [...open, ...waiting]
}

import { writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { entryRef } from './paths'
import { CATEGORIES } from './model'
import { MAX_GROUP_LENGTH, normalizeGroup } from './groups'

/**
 * כתיבת שורות מיובאות.
 *
 * המזהה נגזר מתוכן העסקה ולכן ייבוא חוזר של אותו קובץ כותב מעל אותן
 * שורות במקום לשכפל אותן. זה אותו לקח מהמיגרציה: מזהה אקראי הפך כל
 * הרצה שנייה לכפילות.
 */

const BATCH_LIMIT = 500

function stableTail(seed) {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

const slug = (text) =>
  String(text || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24)

/**
 * שתי קניות זהות באותו יום הן שתי עסקאות אמיתיות, ולכן האינדקס
 * נספר בתוך קבוצת השורות הזהות. הוא יציב בין הרצות כי סדר השורות
 * בקובץ יציב.
 */
export function importedIds(rows) {
  const seen = new Map()
  return rows.map((row) => {
    const key = `${row.date}|${row.amount}|${row.name}`
    const index = seen.get(key) ?? 0
    seen.set(key, index + 1)
    return `imp_${row.date}_${slug(row.name)}_${stableTail(`${key}#${index}`)}`
  })
}

export async function importEntries({ budgetId, uid, rows }) {
  const ids = importedIds(rows)
  let written = 0

  for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (let offset = 0; offset < Math.min(BATCH_LIMIT, rows.length - start); offset += 1) {
      const index = start + offset
      const row = rows[index]
      batch.set(entryRef(budgetId, ids[index]), {
        month: row.month,
        date: row.date,
        category: row.category,
        budgetGroup: CATEGORIES[row.category].budgetGroup,
        name: String(row.name).slice(0, 100),
        plannedAmount: 0,
        actualAmount: row.amount,
        note: '',
        addedBy: uid,
        // בית העסק הוא הקיבוץ, ולכן ייבוא של חודש שלם מופיע כשורה
        // אחת מכווצת לכל חנות ולא כמאתיים שורות שמציפות את הכרטיס
        groupKey: normalizeGroup(String(row.name).slice(0, MAX_GROUP_LENGTH)),
        imported: true,
      })
      written += 1
    }
    await batch.commit()
  }

  return { written }
}

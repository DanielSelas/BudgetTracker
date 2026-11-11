import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
// ההגדרה חיה ב-importRows כי היא נוגעת לקריאת הקובץ, ומיוצאת גם
// מכאן כדי שמי שמסווג לא יצטרך לדעת משני מקומות
import { isStanding } from './importRows'
import { seedCategory } from './sectorSeeds'

/**
 * מה שנלמד על ענפים.
 *
 * חברת האשראי מסווגת כל עסקה לענף, ויש עשרות ענפים לעומת אלפי בתי
 * עסק. לכן ההחלטה "מסעדות הן הוצאה משתנה" נלמדת פעם אחת ומכסה גם
 * מסעדה שלא הייתם בה מעולם.
 *
 * זה אוסף נפרד ולא שדה על התקציב, כי הוא גדל עם הזמן ונקרא רק
 * במסך הייבוא.
 */

/** מזהה מסמך בטוח מתוך שם ענף. */
export const sectorId = (sector) =>
  String(sector || '')
    .trim()
    .replace(/[/\\.#$[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)

const rulesRef = (budgetId) => collection(db, 'budgets', budgetId, 'sectorRules')

export function watchSectorRules(budgetId, onChange, onError) {
  return onSnapshot(
    rulesRef(budgetId),
    (snapshot) => {
      const rules = {}
      for (const item of snapshot.docs) {
        const data = item.data()
        if (data.sector && data.category) rules[data.sector] = data.category
      }
      onChange(rules)
    },
    onError,
  )
}

export { isStanding }
// נשאר מיוצא מכאן כי זה המקום שבו מסווגים חושבים עליו
export { seedCategory }

/**
 * הקטגוריה המוצעת, ומאיפה היא באה.
 *
 * כלל לפי שם בית העסק גובר על הכל, ואחריו הוראת קבע, שהיא הוצאה
 * קבועה מבחינה מבנית ולכן גוברת על הענף.
 * המקור מוחזר כי הוא קובע מה נלמד: מנוי חדר כושר בהוראת קבע לא
 * אמור ללמד שענף הפנאי כולו הוא קבוע.
 */
export function suggestCategory({ sector, type, ruleCategory }, rules = {}) {
  // כלל לפי שם בית העסק גובר על הכל: הוא נקבע ידנית ומכיר את העסק
  // עצמו, בעוד שהענף מתאר רק את סוג ההוצאה
  if (ruleCategory) return { category: ruleCategory, source: 'merchant' }
  if (isStanding(type)) return { category: 'fixed', source: 'standing' }
  if (rules[sector]) return { category: rules[sector], source: 'rule' }
  const seed = seedCategory(sector)
  return seed ? { category: seed, source: 'seed' } : { category: '', source: '' }
}

/** הקטגוריה לענף: מה שנלמד גובר על ניחוש הפתיחה. */
export const categoryFor = (sector, rules = {}) =>
  rules[sector] || seedCategory(sector)

/** זוכר את הבחירות של הייבוא הזה, כדי שהבא יגיע מסווג מראש. */
export async function rememberSectors({ budgetId, uid, choices }) {
  const entries = Object.entries(choices).filter(([sector, category]) => sector && category)
  if (entries.length === 0) return { saved: 0 }

  const batch = writeBatch(db)
  for (const [sector, category] of entries) {
    batch.set(doc(rulesRef(budgetId), sectorId(sector)), {
      sector,
      category,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  return { saved: entries.length }
}

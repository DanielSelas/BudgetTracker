import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

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

// הענפים כאן הם שמות אמיתיים מדוחות אשראי ישראליים, ולא ניחוש.
// הסדר קובע: "מזון מהיר" חייב להיבדק לפני "מזון", אחרת המבורגר
// מסווג כקניות בסופר
const SEEDS = [
  { match: ['מזון מהיר'], category: 'leisure' },
  { match: ['מזון', 'סופר', 'מכולת', 'משקאות'], category: 'fixed' },
  { match: ['חשמל', 'מים', 'תקשורת', 'מחשב', 'סלולר', 'אינטרנט'], category: 'fixed' },
  { match: ['ביטוח', 'פיננס', 'בריאות', 'תרופ', 'רפוא'], category: 'fixed' },
  // הדלק יושב תחת "אנרגיה" ולא תחת "דלק", וזה החמיץ אותו לגמרי
  { match: ['דלק', 'אנרגיה', 'תחבורה', 'חניה', 'רכב'], category: 'fixed' },
  // ארנונה, מים ועירייה. "מוסדות" הוא השם שחברת האשראי נותנת להם
  { match: ['מוסדות', 'ממשל', 'עירי'], category: 'fixed' },
  // דמי כרטיס מגיעים תחת "ציוד ומשרד", והם חיוב חודשי קבוע
  { match: ['ציוד ומשרד'], category: 'fixed' },
  { match: ['מסעד', 'קפה', 'בתי אוכל'], category: 'leisure' },
  { match: ['ביגוד', 'הנעלה', 'אופנה', 'שופינג', 'קניות', 'טיפוח', 'יופי'], category: 'leisure' },
  { match: ['פנאי', 'בידור', 'תרבות', 'ספורט', 'נופש', 'אירוע', 'מזל'], category: 'leisure' },
  { match: ['תיירות', 'מלונ', 'אירוח', 'נסיע'], category: 'leisure' },
  { match: ['ריהוט', 'בית', 'תעשי', 'מכירות'], category: 'leisure' },
]

/**
 * ניחוש פתיחה לענף שעוד לא נלמד.
 * מכוון להיות שמרני: ענף שלא מזוהה בוודאות מוחזר ריק, כי הצעה שגויה
 * גרועה מהיעדר הצעה. המשתמש יבחר, וזה ייזכר.
 */
export function seedCategory(sector) {
  const text = String(sector || '').toLowerCase()
  if (!text) return ''
  const hit = SEEDS.find((seed) => seed.match.some((word) => text.includes(word)))
  return hit?.category || ''
}

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

/** האם סוג העסקה מעיד על חיוב קבוע ולא על קנייה. */
export const isStanding = (type) =>
  /הוראת ?קבע|הו"?ק|standing|direct ?debit/i.test(String(type || ''))

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

/**
 * כללים לפי שם בית עסק.
 *
 * הענף עונה על "איזה מין הוצאה זו", והשם עונה על "איזה עסק זה". יש
 * מקרים שבהם רק השם יודע: עלי אקספרס מגיע תחת מזון ומשקאות ואינו
 * קניות בסופר, וניתוח חירום לחיה מגיע תחת רפואה כמו קופסת אקמול.
 *
 * הכללים כאן נקבעו מתוך הדוחות האמיתיים ולא מתוך ניחוש, ולכן הם
 * מותאמים לאיך שהשמות באמת כתובים שם: "אלמה מקרט" ולא "אלמה מרקט",
 * "דראגסטור" במילה אחת, ו"מנו וינו" בלי הסיומת.
 */

/**
 * שבר קצר נבדק כמילה שלמה ולא כתת מחרוזת: "פז" בתוך מילה אחרת אינו
 * תחנת דלק, ובעברית אין גבולות מילה ב-\b של ביטוי רגולרי.
 */
const hasWord = (text, word) => {
  const lower = word.toLowerCase()
  return text
    .split(/[\s*,.\-/()"']+/)
    .some((part) => part.toLowerCase() === lower)
}

const matches = (name, rule) => {
  const text = String(name || '').toLowerCase()
  if (!text) return false
  return (rule.match || []).some((word) => text.includes(word.toLowerCase()))
    || (rule.words || []).some((word) => hasWord(String(name), word))
}

/**
 * קיבוץ לפי שם: כל הסופרים הם שורה אחת שנפתחת, וכך גם הדלק.
 * סופר פארם לפני הסופר, כדי שבית מרקחת לא ייבלע בקניות.
 */
export const GROUP_RULES = [
  { group: 'סופר פארם', match: ['סופר פארם', 'בי פארם', 'בית מרקחת'] },
  {
    group: 'סופר',
    match: [
      'שופרסל', 'אטליז', 'קשת טעמים', 'טיב טעם', 'סופר יודה', 'אלמה',
      'מנו וינו', 'נאטסטיישן', 'יוחננוף', 'דראגסטור', 'am pm',
    ],
  },
  { group: 'דלק', match: ['דלק', 'מנטה'], words: ['פז'] },
]

/** קטגוריה שנגזרת מהעסק עצמו, כשהענף שלו מטעה. */
export const CATEGORY_RULES = [
  { category: 'leisure', match: ['aliexpress'], words: ['lime', 'tuki'] },
  { category: 'unplanned', match: ['סקוט אייר'] },
]

/** הקבוצה שאליה בית העסק שייך, או ריק אם אין כלל. */
export const merchantGroup = (name) =>
  GROUP_RULES.find((rule) => matches(name, rule))?.group || ''

/** הקטגוריה שנקבעת לפי שם העסק, או ריק אם אין כלל. */
export const merchantCategory = (name) =>
  CATEGORY_RULES.find((rule) => matches(name, rule))?.category || ''

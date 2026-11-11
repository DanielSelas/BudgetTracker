import { merchantCategory, merchantGroup } from './merchants'
import { normalizeGroup } from './groups'

/**
 * קליטה מהירה: משפט אחד שהופך להוצאה ממתינה.
 *
 * הקיצור ב-iOS שולח טקסט חופשי, כי לבקש סכום ושם בשתי שאלות נפרדות
 * זה שתי שאלות נפרדות, וכל שאלה היא עוד סיבה לא לעשות את זה. לכן
 * הפענוח כאן ולא שם: "חמישים שקל סופר" ו"סופר 50" הם אותו דבר.
 */

// מילות מספר, כי הכתבה קולית לא תמיד נותנת ספרות. הצורות הזוגיות
// והנסמכות כאן בכוונה: "שני", "שלושת", "עשרת" נאמרות בפועל
const WORDS = {
  אחת: 1, אחד: 1,
  שתיים: 2, שניים: 2, שתי: 2, שני: 2,
  שלוש: 3, שלושה: 3, שלושת: 3,
  ארבע: 4, ארבעה: 4, ארבעת: 4,
  חמש: 5, חמישה: 5, חמשת: 5,
  שש: 6, שישה: 6, ששת: 6,
  שבע: 7, שבעה: 7, שבעת: 7,
  שמונה: 8, שמונת: 8,
  תשע: 9, תשעה: 9, תשעת: 9,
  עשר: 10, עשרה: 10, עשרת: 10,
  עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50,
  שישים: 60, ששים: 60, שבעים: 70, שמונים: 80, תשעים: 90,
  מאה: 100, מאתיים: 200,
  אלף: 1000, אלפיים: 2000,
}

// כפולות שבאות אחרי מספר: "חמש מאות", "שלושת אלפים"
const SCALES = { מאות: 100, אלפים: 1000 }

// מילים שאינן חלק מהשם ואינן חלק מהמספר
const NOISE = new Set(['שקל', 'שקלים', 'שח', 'שקלים', 'ש"ח', 'ש״ח', 'על', 'של', 'בסך'])

const isNumberWord = (token) => {
  const word = token.replace(/^ו/, '')
  return word in WORDS || word in SCALES
}

/**
 * סכום של רצף מילות מספר. הסכימה פשוטה כי כך עברית עובדת:
 * "עשרים ושלוש" זה חיבור, ו"חמש מאות" זה כפל של מה שלפניו.
 */
function hebrewAmount(tokens) {
  let total = 0
  let pending = 0

  for (const token of tokens) {
    const word = token.replace(/^ו/, '')
    if (word in SCALES) {
      // בלי מספר לפניו, "מאות" לבד אינו כלום, ולכן ברירת המחדל אחת
      total += (pending || 1) * SCALES[word]
      pending = 0
      continue
    }
    pending += WORDS[word] || 0
  }

  return total + pending
}

// 1,250 ו-1250.50 שניהם מספרים; הפסיק הוא מפריד אלפים ולא עשרוני
const DIGITS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$|^\d+(?:\.\d+)?$/

/**
 * מפריד סכום משם. מחזיר תמיד אובייקט, גם כשחסר אחד מהם: מי שקורא
 * מחליט מה לעשות עם קליטה חלקית, וכאן אין מה להחליט.
 */
export function parseCapture(text) {
  const tokens = String(text || '')
    .replace(/[₪]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NOISE.has(token.toLowerCase()))

  let amount = 0
  const rest = []

  // ספרות גוברות על מילים: כשיש 50 בטקסט אין מה לנחש, וגם אין סיכון
  // שבית עסק ששמו "שבע" ייחשב למספר
  const digitAt = tokens.findIndex((token) => DIGITS.test(token))
  if (digitAt >= 0) {
    amount = Number(tokens[digitAt].replace(/,/g, ''))
    rest.push(...tokens.slice(0, digitAt), ...tokens.slice(digitAt + 1))
  } else {
    // הרצף הרציף הארוך ביותר של מילות מספר, כי המספר יכול לבוא
    // בהתחלה או בסוף, אבל הוא תמיד רצף אחד
    let bestStart = -1
    let bestLength = 0
    let start = -1
    for (let index = 0; index <= tokens.length; index += 1) {
      if (index < tokens.length && isNumberWord(tokens[index])) {
        if (start < 0) start = index
        continue
      }
      if (start >= 0 && index - start > bestLength) {
        bestStart = start
        bestLength = index - start
      }
      start = -1
    }

    if (bestLength > 0) {
      amount = hebrewAmount(tokens.slice(bestStart, bestStart + bestLength))
      rest.push(
        ...tokens.slice(0, bestStart),
        ...tokens.slice(bestStart + bestLength),
      )
    } else {
      rest.push(...tokens)
    }
  }

  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    name: rest.join(' ').slice(0, 100),
  }
}

/**
 * איזו קטגוריה מתאימה להוצאה שנקלטה.
 *
 * מהקיצור מגיע שם בלבד ולא ענף, ולכן כללי הענפים אינם עוזרים כאן.
 * מה שכן עוזר זה מה שכבר אושר בעבר: ברגע שסיווגת "סופר" פעם אחת,
 * כל סופר הבא מגיע מסווג. זו הסיבה היחידה שאישור הופך להרגל ולא
 * לעוד טופס.
 */
export function suggestForCapture(name, entries = []) {
  const group = merchantGroup(name)
  const byMerchant = merchantCategory(name)
  if (byMerchant) return { category: byMerchant, groupKey: group, source: 'merchant' }

  const needle = String(name || '').trim().toLowerCase()
  if (!needle) return { category: '', groupKey: group, source: '' }

  // התאמה לפי הקבוצה כשיש לה כלל, ואחרת לפי השם עצמו. ההכנסות
  // מוחרגות: שם של משכורת שמתנגש בשם של חנות אינו ראיה לכלום
  const counts = new Map()
  let matchedGroup = group
  for (const entry of entries) {
    if (entry.category === 'income') continue
    const entryGroup = normalizeGroup(entry.groupKey)
    const same = group
      ? entryGroup === group
      : String(entry.name || '').trim().toLowerCase() === needle
    if (!same) continue
    counts.set(entry.category, (counts.get(entry.category) || 0) + 1)
    if (!matchedGroup && entryGroup) matchedGroup = entryGroup
  }

  if (counts.size === 0) return { category: '', groupKey: group, source: '' }

  const [category] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return { category, groupKey: matchedGroup, source: 'history' }
}

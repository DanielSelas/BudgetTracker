/**
 * הבנת קובץ ההוצאות: איפה הכותרת, ומה כל עמודה.
 *
 * במקום מפענח לכל חברת אשראי, זיהוי לפי תוכן. חברה שלא ראיתי עדיין
 * עובדת, ומשתמש שרואה ניחוש שגוי יכול לתקן אותו במקום להיתקע.
 */

const DATE_WORDS = ['תאריך', 'date', 'יום']
// "עסקה" הוסר בכוונה: הוא מופיע גם ב"תאריך עסקה", ב"סוג עסקה"
// וב"סכום עסקה", ולכן הוא מסמן הכל ואינו מסמן כלום
const AMOUNT_WORDS = ['סכום', 'חיוב', 'amount', 'debit', 'sum']
const NAME_WORDS = ['בית עסק', 'תיאור', 'שם', 'merchant', 'description', 'פירוט', 'עסק']
// ענף הוא הסיווג של חברת האשראי עצמה, והוא מפתח חזק בהרבה משם בית
// עסק: יש אלפי עסקים אבל עשרות ענפים, ולכן למידה עליו מתכנסת מהר
const SECTOR_WORDS = ['ענף', 'קטגוריה', 'תחום', 'sector', 'category', 'סיווג']
// סוג העסקה מבחין בין רגילה, הוראת קבע ותשלומים. הוראת קבע היא
// הוצאה קבועה מבחינה מבנית, בלי קשר לענף שלה
const TYPE_WORDS = ['סוג עסקה', 'סוג', 'type']
// "פירוט" נמצא כבר ב-NAME_WORDS, ולכן הוא לא כאן: הוא היה מושך את
// עמודת שם בית העסק לתפקיד ההערות
const NOTE_WORDS = ['הערות', 'הערה', 'note', 'notes', 'remarks']

/**
 * "תשלום 1 מתוך 3" בהערות.
 *
 * זו לא הערה אלא נתון: הסכום בשורה הוא התשלום החודשי ולא המחיר,
 * ויש עוד תשלומים שכבר התחייבנו אליהם ושלא מופיעים בשום מקום.
 */
export function parseInstallment(note) {
  const text = String(note || '')
  const match = text.match(/(\d{1,2})\s*(?:מתוך|מ־|מ-|out of|\/)\s*(\d{1,2})/)
  if (!match) return null
  const index = Number(match[1])
  const total = Number(match[2])
  // תשלום 0 או "1 מתוך 1" אינם עסקת תשלומים, והפוך מזה חסר משמעות
  if (!index || total < 2 || index > total) return null
  return { index, total }
}

const DATE_PATTERNS = [
  // 01/09/2026 או 1.9.26
  /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/,
  // 2026-09-01
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
]

/** תאריך מכל אחד מהפורמטים הנפוצים, כ-YYYY-MM-DD. */
export function parseDate(value) {
  const text = String(value || '').trim()
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    let [, a, b, c] = match
    let year
    let month
    let day
    if (a.length === 4) {
      [year, month, day] = [a, b, c]
    } else {
      // בישראל הסדר הוא יום לפני חודש
      [day, month, year] = [a, b, c]
      if (year.length === 2) year = `20${year}`
    }
    const pad = (part) => String(part).padStart(2, '0')
    if (Number(month) < 1 || Number(month) > 12) return ''
    if (Number(day) < 1 || Number(day) > 31) return ''
    return `${year}-${pad(month)}-${pad(day)}`
  }
  return ''
}

/** סכום מתוך מחרוזת עם פסיקים, מטבע, או סוגריים לשלילי. */
export function parseAmount(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text) || text.includes('-')
  const digits = text.replace(/[^\d.]/g, '')
  if (!digits) return null
  const amount = Number(digits)
  if (!Number.isFinite(amount)) return null
  return negative ? -amount : amount
}

const scoreColumn = (values, test) =>
  values.filter((value) => test(value)).length / Math.max(values.length, 1)

/**
 * כמה מילים מהרשימה מופיעות בכותרת, ולא רק האם אחת מהן.
 *
 * בדוח אשראי יש "סכום עסקה" ו"סכום חיוב", ומה שצריך הוא חיוב, כי
 * בעסקה במט״ח השתיים שונות. ספירה מבדילה ביניהן, והאם יש התאמה לא.
 */
const headerScore = (header, words) => {
  const text = String(header || '').toLowerCase()
  return words.filter((word) => text.includes(word)).length
}

/**
 * איזו שורה היא הכותרת.
 * זו השורה הראשונה שאחריה רוב השורות נראות כמו נתונים, כלומר יש בהן
 * תאריך וסכום. קבצים ישראליים פותחים בכותרות כלליות ובשורות ריקות.
 */
const isDataRow = (row = []) =>
  row.some((cell) => parseDate(cell)) && row.some((cell) => parseAmount(cell) !== null)

/**
 * הכותרת היא השורה שמיד לפני שורת הנתונים הראשונה.
 *
 * ניסיון לזהות אותה לפי "רוב השורות שאחריה נראות כמו נתונים" נכשל,
 * כי שורות הפתיח של הקובץ מכילות תאריכי תקופה ומספרי כרטיס, ולכן
 * חלון שמסתכל קדימה תופס אותן גם כשהוא מתחיל גבוה מדי.
 */
export function findHeaderRow(rows) {
  const firstData = rows.findIndex(isDataRow)
  if (firstData <= 0) return -1

  // מדלגים אחורה על שורות מפרידות שאין בהן שמות עמודות
  for (let index = firstData - 1; index >= 0; index -= 1) {
    const filled = rows[index].filter((cell) => String(cell || '').trim()).length
    if (filled >= 2) return index
  }
  return -1
}

/**
 * ניחוש העמודות. שם העמודה מנצח כשהוא ברור, ואחרת מכריע התוכן:
 * עמודת תאריך היא זו שרוב ערכיה נקראים כתאריך.
 */
export function detectColumns(rows, headerRow = findHeaderRow(rows)) {
  const header = rows[headerRow] || []
  const body = rows.slice(headerRow + 1, headerRow + 40)
  const columns = Math.max(header.length, ...body.map((row) => row.length), 0)

  /**
   * עמודה אופציונלית נבחרת רק אם הכותרת מסכימה. בלי זה עמודת "הערות"
   * מלאת טקסט הייתה נבחרת כענף, וממנה גם היינו לומדים כללים.
   */
  const pick = (words, test, exclude = [], needHeader = false) => {
    let best = -1
    let bestScore = 0
    for (let index = 0; index < columns; index += 1) {
      if (exclude.includes(index)) continue
      const named = headerScore(header[index], words)
      if (needHeader && named === 0) continue
      const values = body.map((row) => row[index])
      const score = named * 2 + scoreColumn(values, test)
      if (score > bestScore) {
        bestScore = score
        best = index
      }
    }
    return bestScore > 0.4 ? best : -1
  }

  const date = pick(DATE_WORDS, (value) => Boolean(parseDate(value)))
  const amount = pick(AMOUNT_WORDS, (value) => parseAmount(value) !== null, [date])
  // שם הוא עמודת טקסט, ולכן מזוהה בשלילה: לא תאריך ולא מספר
  const name = pick(
    NAME_WORDS,
    (value) => {
      const text = String(value || '').trim()
      return text.length > 1 && !parseDate(text) && parseAmount(text) === null
    },
    [date, amount],
  )

  const isLabel = (value) => {
    const text = String(value || '').trim()
    return text.length > 1 && !parseDate(text) && parseAmount(text) === null
  }

  // הענף אופציונלי: לא כל קובץ מכיל אותו, ובלעדיו פשוט אין הצעה
  const sector = pick(SECTOR_WORDS, isLabel, [date, amount, name], true)
  const type = pick(TYPE_WORDS, isLabel, [date, amount, name, sector], true)
  const note = pick(NOTE_WORDS, isLabel, [date, amount, name, sector, type], true)

  return { headerRow, date, amount, name, sector, type, note }
}

/** השורות שאפשר להזין, אחרי שהוחלט מה כל עמודה. */
export function extractRows(rows, mapping) {
  const { headerRow, date, amount, name, sector, type, note } = mapping
  const out = []
  let skipped = 0

  for (const row of rows.slice(headerRow + 1)) {
    const when = parseDate(row[date])
    const value = parseAmount(row[amount])
    const label = String(row[name] ?? '').trim()
    const text = note >= 0 ? String(row[note] ?? '').trim() : ''

    // זיכוי נשמר כסכום שלילי ומקזז את הקטגוריה שלו. מה שאין לו
    // תאריך או סכום הוא שורת סיכום או פתיח, וזה מה שמדולג
    if (!when || value === null || value === 0) {
      skipped += 1
      continue
    }

    out.push({
      date: when,
      month: when.slice(0, 7),
      amount: Math.round(value * 100) / 100,
      name: label || 'הוצאה',
      sector: sector >= 0 ? String(row[sector] ?? '').trim() : '',
      type: type >= 0 ? String(row[type] ?? '').trim() : '',
      note: text,
      installment: parseInstallment(text),
    })
  }

  return { rows: out, skipped }
}

/** קיבוץ לפי בית עסק, כי סיווג לפי עסקה אינו בר ביצוע. */
/** מה שעוד צפוי לרדת מהעסקה הזאת אחרי החיוב שבקובץ. */
export const remainingOf = (row) =>
  row.installment && row.amount > 0
    ? row.amount * (row.installment.total - row.installment.index)
    : 0

const addMonths = (month, count) => {
  const [year, index] = month.split('-').map(Number)
  const moved = new Date(Date.UTC(year, index - 1 + count, 1))
  return moved.toISOString().slice(0, 7)
}

/**
 * מה שכבר התחייבנו אליו ועוד לא ירד.
 *
 * עסקת תשלומים היא הוצאה של החודשים הבאים שנחתמה החודש, ובלי הפירוק
 * הזה היא פשוט לא קיימת בתקציב עד שהיא מפתיעה.
 */
export function installmentPlan(rows) {
  // אותה עסקה מופיעה שוב בכל חודש שהיא ירדה בו. קובץ שחוצה חודשים
  // מכיל גם "1 מתוך 3" וגם "2 מתוך 3" של אותה קנייה, ורק התשלום
  // המתקדם ביותר מלמד מה באמת נשאר. בלי זה החודשים המשותפים
  // נספרים פעמיים
  const latest = new Map()
  for (const row of rows) {
    if (!row.installment || row.amount <= 0) continue
    const key = `${row.name}|${row.amount}|${row.installment.total}`
    const known = latest.get(key)
    if (!known || row.installment.index > known.installment.index) latest.set(key, row)
  }

  const months = new Map()
  for (const row of latest.values()) {
    for (let step = 1; step <= row.installment.total - row.installment.index; step += 1) {
      const month = addMonths(row.month, step)
      months.set(month, (months.get(month) || 0) + row.amount)
    }
  }

  const byMonth = [...months.entries()]
    .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    count: latest.size,
    total: Math.round(byMonth.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    byMonth,
  }
}

export function byMerchant(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.name
    if (!groups.has(key)) {
      groups.set(key, { name: key, rows: [], total: 0, sectors: new Map(), types: new Map() })
    }
    const group = groups.get(key)
    group.rows.push(row)
    group.total += row.amount
    if (row.sector) group.sectors.set(row.sector, (group.sectors.get(row.sector) || 0) + 1)
    if (row.type) group.types.set(row.type, (group.types.get(row.type) || 0) + 1)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      // אותו עסק יכול להופיע בשני ענפים, והשכיח הוא הנכון
      sector: [...group.sectors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      type: [...group.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      // התשלום האחרון בקבוצה הוא המצב העדכני של העסקה
      installment: group.rows.filter((row) => row.installment).at(-1)?.installment || null,
      remaining: group.rows.reduce((sum, row) => sum + remainingOf(row), 0),
    }))
    .sort((a, b) => b.total - a.total)
}

/** אילו חודשים הקובץ נוגע בהם, לפי סדר. */
export const monthsIn = (rows = []) =>
  [...new Set(rows.map((row) => row.month))].sort()

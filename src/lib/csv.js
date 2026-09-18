/**
 * קריאת CSV מקובץ אמיתי, לא מקובץ אידיאלי.
 *
 * קבצי ייצוא של חברות אשראי בישראל מגיעים עם סימן BOM, לפעמים עם
 * נקודה פסיק במקום פסיק, לפעמים בקידוד windows-1255, וכמעט תמיד עם
 * כמה שורות כותרת מיותרות מעל השורה האמיתית. כל אחד מאלה לבדו שובר
 * פענוח נאיבי.
 */

const DELIMITERS = [',', ';', '\t', '|']

/** הקידוד שבו הטקסט נראה הגיוני. עברית שבורה היא הסימן הבטוח. */
export async function readText(file) {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  // תו ההחלפה מופיע כשהפענוח נכשל, וזה המקרה של קובץ בקידוד ישן
  if (!utf8.includes('�')) return stripBom(utf8)
  try {
    return stripBom(new TextDecoder('windows-1255').decode(buffer))
  } catch {
    return stripBom(utf8)
  }
}

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)

/** המפריד שמייצר הכי הרבה עמודות באופן עקבי. */
export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 20)
  let best = ','
  let bestScore = 0
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => splitLine(line, delimiter).length)
    const most = Math.max(...counts, 0)
    if (most < 2) continue
    // עקביות חשובה מכמות: מפריד נכון נותן אותו מספר עמודות בכל שורה
    const consistent = counts.filter((count) => count === most).length
    const score = most * consistent
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }
  return best
}

/** שורה אחת, עם כיבוד מרכאות ומרכאות כפולות בתוכן. */
export function splitLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

/** כל השורות, בלי ריקות. */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => splitLine(line, delimiter))
}

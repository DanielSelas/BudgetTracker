import { CATEGORIES } from './model'
import { monthLabel, shekels } from './format'
import { buildCapacity } from './capacity'
import { groupEntries } from './groups'

/**
 * מה שנשלח לשרת כשמדברים עם היועץ.
 *
 * תמונה מסוכמת ולא רשימת עסקאות. שלוש סיבות: היא מספיקה כדי לענות
 * על השאלות שבאמת נשאלות, היא עולה פחות אסימונים, ובעיקר היא
 * מגבילה כמה מידע אישי עוזב את המכשיר. שם של בית עסק בודד לא נחוץ
 * כדי לענות "האם אני יכול לטוס".
 *
 * הפונקציה טהורה, ולכן אפשר לראות בדיוק מה נשלח ולבדוק את זה.
 */

const line = (label, value) => `${label}: ${shekels(value)}`

/** הקבוצות הגדולות של החודש, בלי שמות של עסקים בודדים. */
function topGroups(entries, limit = 6) {
  const items = groupEntries(entries.filter((entry) => entry.category !== 'income'))
  return items
    .map((item) => (item.kind === 'group'
      ? { name: item.key, amount: item.total }
      : { name: item.entry.name, amount: item.entry.actualAmount || 0 }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

export function buildChatContext({
  month, summary, entries = [], history = [], templates = [], billingDay,
}) {
  const { line: capacity, typical } = buildCapacity({
    entries: history, templates, now: month, months: 6,
  })

  const groups = ['fixed', 'leisure', 'savings']
    .map((group) => {
      const category = Object.keys(CATEGORIES)
        .find((key) => CATEGORIES[key].budgetGroup === group)
      const data = summary.groups[group]
      return `  ${CATEGORIES[category].label}: ${shekels(data.actual)} מתוך יעד ${shekels(data.target)}`
    })
    .join('\n')

  const commitments = capacity[0]?.items ?? []

  return [
    `החודש: ${monthLabel(month)}${billingDay ? `, מועד חיוב ${billingDay} בחודש` : ''}`,
    '',
    'החודש הנוכחי:',
    `  ${line('הכנסות', summary.totalIncome)}`,
    `  ${line('הוצאות', summary.totalExpenses)}`,
    `  ${line('נשאר', summary.balance)}`,
    `  ${line('סכום בסיס', summary.baseAmount)}${summary.usesFixedBase ? ' (נקבע ידנית)' : ' (נגזר מההכנסה)'}`,
    groups,
    '',
    'ההוצאות הגדולות החודש:',
    ...topGroups(entries).map((item) => `  ${item.name}: ${shekels(item.amount)}`),
    '',
    'התחייבויות קבועות:',
    ...(commitments.length > 0
      ? commitments.map((item) => `  ${item.name}: ${shekels(item.amount)}`)
      : ['  אין התחייבויות מוגדרות']),
    '',
    `חודש רגיל, לפי חציון ${typical.months} חודשים, בלי מה שסומן כחד פעמי: ${shekels(typical.amount)}`,
    '',
    'כמה פנוי בחודשים הקרובים, לפי מה שידוע בוודאות:',
    ...capacity.map((item) => {
      const ends = item.ending.length > 0 ? ` (נגמר: ${item.ending.join(', ')})` : ''
      return `  ${monthLabel(item.month)}: ${shekels(item.available)}${ends}`
    }),
  ].join('\n')
}

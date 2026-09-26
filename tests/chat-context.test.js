import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/firebase', () => ({ db: {} }))
const { buildChatContext } = await import('../src/lib/chatContext')
const { summarizeMonth } = await import('../src/lib/model')

/**
 * מה שנשלח ליועץ הוא תמונה מסוכמת ולא רשימת עסקאות. זו לא רק שאלה
 * של אסימונים: זו ההחלטה כמה מידע אישי עוזב את המכשיר, ולכן היא
 * נבדקת ולא נשארת להנחה.
 */
const entries = [
  { id: '1', month: '2026-09', category: 'income', budgetGroup: 'none', name: 'משכורת', actualAmount: 20000 },
  { id: '2', month: '2026-09', category: 'fixed', budgetGroup: 'fixed', name: 'שופרסל גבעתיים', actualAmount: 300, groupKey: 'סופר' },
  { id: '3', month: '2026-09', category: 'fixed', budgetGroup: 'fixed', name: 'טיב טעם', actualAmount: 200, groupKey: 'סופר' },
  { id: '4', month: '2026-09', category: 'leisure', budgetGroup: 'leisure', name: 'מסעדה', actualAmount: 450 },
]
const templates = [
  { id: 'rent', name: 'שכר דירה', active: true, category: 'fixed', actualAmount: 5800, startMonth: '2026-01' },
]
const context = () => buildChatContext({
  month: '2026-09',
  summary: summarizeMonth(entries),
  entries,
  history: entries,
  templates,
  billingDay: 10,
})

describe('ההקשר שנשלח ליועץ', () => {
  it('כולל את המספרים של החודש', () => {
    const text = context()
    expect(text).toContain('ספטמבר 2026')
    expect(text).toContain('הכנסות')
    expect(text).toContain('20,000')
  })

  it('מקבץ הוצאות ולא מפרט עסקאות בודדות', () => {
    const text = context()
    // "סופר" הוא הקיבוץ, והסניפים עצמם אינם נחוצים כדי לייעץ
    expect(text).toContain('סופר')
    expect(text).not.toContain('שופרסל גבעתיים')
    expect(text).not.toContain('טיב טעם')
  })

  it('כולל את ההתחייבויות הידועות ואת הקו קדימה', () => {
    const text = context()
    expect(text).toContain('שכר דירה')
    expect(text).toContain('כמה פנוי בחודשים הקרובים')
  })

  it('אומר אם סכום הבסיס נקבע ידנית או נגזר', () => {
    expect(context()).toContain('נגזר מההכנסה')
    const fixed = buildChatContext({
      month: '2026-09',
      summary: summarizeMonth(entries, { fixedBase: 15000 }),
      entries, history: entries, templates,
    })
    expect(fixed).toContain('נקבע ידנית')
  })

  it('בלי התחייבויות אומר זאת במפורש', () => {
    const text = buildChatContext({
      month: '2026-09', summary: summarizeMonth(entries), entries, history: [], templates: [],
    })
    expect(text).toContain('אין התחייבויות מוגדרות')
  })
})

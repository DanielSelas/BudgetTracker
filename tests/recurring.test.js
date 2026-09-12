import { describe, expect, it } from 'vitest'
import {
  entryFromTemplate,
  materializedEntryId,
  pendingTemplates,
} from '../src/lib/recurring'

const template = (overrides = {}) => ({
  id: 't1',
  category: 'fixed',
  budgetGroup: 'fixed',
  name: 'שכר דירה',
  plannedAmount: 5500,
  actualAmount: 5500,
  startMonth: '2026-09',
  active: true,
  skipMonths: [],
  ...overrides,
})

describe('materializedEntryId', () => {
  it('יציב וייחודי לכל שילוב של תבנית וחודש', () => {
    expect(materializedEntryId('t1', '2026-09')).toBe('t1__2026-09')
    expect(materializedEntryId('t1', '2026-09')).toBe(materializedEntryId('t1', '2026-09'))
    expect(materializedEntryId('t1', '2026-10')).not.toBe(materializedEntryId('t1', '2026-09'))
  })
})

describe('pendingTemplates', () => {
  it('תבנית פעילה בלי שורה בחודש היא ממתינה', () => {
    expect(pendingTemplates([template()], [], '2026-09')).toHaveLength(1)
  })

  it('לא מייצר שורה פעמיים לאותו חודש', () => {
    const entries = [{ id: 'x', recurringId: 't1' }]
    expect(pendingTemplates([template()], entries, '2026-09')).toHaveLength(0)
  })

  it('לא חל על חודשים שלפני תחילת החיוב', () => {
    expect(pendingTemplates([template()], [], '2026-08')).toHaveLength(0)
    expect(pendingTemplates([template()], [], '2026-10')).toHaveLength(1)
  })

  it('מדלג על חודש שסומן לדילוג', () => {
    const skipped = template({ skipMonths: ['2026-10'] })
    expect(pendingTemplates([skipped], [], '2026-10')).toHaveLength(0)
    expect(pendingTemplates([skipped], [], '2026-11')).toHaveLength(1)
  })

  it('תבנית כבויה לא מייצרת כלום', () => {
    expect(pendingTemplates([template({ active: false })], [], '2026-09')).toHaveLength(0)
  })

  it('עומד גם כששדה הדילוגים חסר', () => {
    const legacy = { ...template(), skipMonths: undefined }
    expect(pendingTemplates([legacy], [], '2026-09')).toHaveLength(1)
  })
})

describe('entryFromTemplate', () => {
  it('גוזר שורה מלאה עם קישור חזרה לתבנית', () => {
    const entry = entryFromTemplate(template(), { budgetId: 'b1', month: '2026-10', uid: 'u1' })
    expect(entry).toMatchObject({
      budgetId: 'b1',
      month: '2026-10',
      category: 'fixed',
      budgetGroup: 'fixed',
      name: 'שכר דירה',
      actualAmount: 5500,
      addedBy: 'u1',
      recurringId: 't1',
    })
  })
})

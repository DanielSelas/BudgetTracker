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
    const entry = entryFromTemplate(template(), { month: '2026-10', uid: 'u1' })
    expect(entry).toMatchObject({
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

describe('חיוב קבוע לתקופה', () => {
  const template = (extra = {}) => ({
    id: 'r1', active: true, startMonth: '2026-09', skipMonths: [],
    category: 'fixed', budgetGroup: 'fixed', name: 'שכר דירה',
    plannedAmount: 5200, actualAmount: 5200, ...extra,
  })

  it('בלי סיום ממשיך כמו קודם', async () => {
    const { pendingTemplates } = await import('../src/lib/recurring')
    expect(pendingTemplates([template()], [], '2027-05')).toHaveLength(1)
  })

  it('אחרי חודש הסיום מפסיק להיווצר', async () => {
    const { pendingTemplates } = await import('../src/lib/recurring')
    const rent = template({ endMonth: '2027-08' })
    expect(pendingTemplates([rent], [], '2027-08')).toHaveLength(1)
    expect(pendingTemplates([rent], [], '2027-09')).toHaveLength(0)
  })

  it('חודש הסיום עצמו עדיין נוצר', async () => {
    const { isEnded } = await import('../src/lib/recurring')
    expect(isEnded(template({ endMonth: '2027-08' }), '2027-08')).toBe(false)
    expect(isEnded(template({ endMonth: '2027-08' }), '2027-09')).toBe(true)
    expect(isEnded(template(), '2030-01')).toBe(false)
  })

  it('מספר תשלומים מתורגם לחודש סיום, כולל התשלום הראשון', async () => {
    const { endAfterPayments } = await import('../src/lib/recurring')
    expect(endAfterPayments('2026-09', 1)).toBe('2026-09')
    expect(endAfterPayments('2026-09', 12)).toBe('2027-08')
    expect(endAfterPayments('2026-09', 0)).toBe('')
    expect(endAfterPayments('', 12)).toBe('')
  })

  it('מתריע על מה שנגמר החודש או בחודש הבא בלבד', async () => {
    const { endingSoon } = await import('../src/lib/recurring')
    const list = [
      template({ id: 'a', endMonth: '2026-09' }),
      template({ id: 'b', endMonth: '2026-10' }),
      template({ id: 'c', endMonth: '2026-12' }),
      template({ id: 'd' }),
    ]
    const soon = endingSoon(list, '2026-09')
    expect(soon.map((item) => item.id)).toEqual(['a', 'b'])
    expect(soon[0].endsThisMonth).toBe(true)
    expect(soon[1].endsThisMonth).toBe(false)
  })
})

describe('מה ייגבה בכרטיס', () => {
  const income = (actualAmount) => ({ category: 'income', actualAmount })
  const spend = (actualAmount, recurringId) => ({
    id: `e${actualAmount}`, category: 'fixed', name: 'הוצאה', actualAmount, recurringId,
  })

  it('בלי סימונים הכל נחשב כרטיס', async () => {
    const { upcomingCharge } = await import('../src/lib/recurring')
    const result = upcomingCharge([income(24600), spend(5200), spend(800)], [])
    expect(result.card).toBe(6000)
    expect(result.direct).toBe(0)
  })

  it('חיוב שסומן יורד מהחשבון ואינו נכנס לחיוב האשראי', async () => {
    const { upcomingCharge } = await import('../src/lib/recurring')
    const templates = [{ id: 'rent', offCard: true }, { id: 'gym' }]
    const result = upcomingCharge(
      [income(24600), spend(5200, 'rent'), spend(200, 'gym'), spend(800)],
      templates,
    )
    expect(result.card).toBe(1000)
    expect(result.direct).toBe(5200)
    expect(result.directRows).toHaveLength(1)
  })

  it('הכנסה אינה נספרת כחיוב', async () => {
    const { upcomingCharge } = await import('../src/lib/recurring')
    const result = upcomingCharge([income(24600)], [])
    expect(result.card).toBe(0)
    expect(result.income).toBe(24600)
    expect(result.left).toBe(24600)
  })

  it('השורה התחתונה מקזזת את שניהם', async () => {
    const { upcomingCharge } = await import('../src/lib/recurring')
    const result = upcomingCharge(
      [income(24600), spend(5200, 'rent'), spend(800)],
      [{ id: 'rent', offCard: true }],
    )
    expect(result.left).toBe(24600 - 6000)
  })
})

describe('ציר הזמן של החיובים הקרובים', () => {
  const at = (iso) => new Date(iso)

  it('התאריך הקרוב של יום בחודש, וגלישה לחודש הבא כשהוא כבר עבר', async () => {
    const { nextOccurrence, formatDay } = await import('../src/lib/upcoming')
    expect(formatDay(nextOccurrence(10, at('2026-09-05T08:00:00')))).toBe('10.9')
    expect(formatDay(nextOccurrence(2, at('2026-09-05T08:00:00')))).toBe('2.10')
    // היום עצמו עדיין נחשב קרוב, ולא נדחה בחודש
    expect(formatDay(nextOccurrence(5, at('2026-09-05T08:00:00')))).toBe('5.9')
    expect(nextOccurrence(31, at('2026-09-05T08:00:00'))).toBeNull()
  })

  it('חיוב שעובר בכרטיס אינו אירוע נפרד, כי הוא כבר בחיוב האשראי', async () => {
    const { buildTimeline } = await import('../src/lib/upcoming')
    const events = buildTimeline({
      templates: [{ id: 'gym', active: true, dueDay: 5, name: 'חדר כושר', actualAmount: 200 }],
      cardTotal: 12230,
      billingDay: 2,
      today: at('2026-09-03T08:00:00'),
    })
    expect(events.map((event) => event.id)).toEqual(['card'])
  })

  it('מסדר לפי תאריך ומסמן הכנסה כחיובית', async () => {
    const { buildTimeline } = await import('../src/lib/upcoming')
    const events = buildTimeline({
      templates: [
        { id: 'rent', active: true, dueDay: 1, offCard: true, name: 'שכר דירה', actualAmount: 5200 },
        { id: 'pay', active: true, dueDay: 10, category: 'income', name: 'משכורת', actualAmount: 24600 },
      ],
      cardTotal: 12230,
      billingDay: 2,
      today: at('2026-09-03T08:00:00'),
    })
    expect(events.map((event) => event.name)).toEqual(['משכורת', 'שכר דירה', 'חיוב האשראי'])
    expect(events[0].amount).toBe(24600)
    expect(events[1].amount).toBe(-5200)
  })

  it('הנקודה הקשה היא השפל בציר, לא הסכום הכולל', async () => {
    const { peakRequirement } = await import('../src/lib/upcoming')
    const events = [
      { id: 'a', name: 'שכר דירה', amount: -5200, when: new Date('2026-10-01') },
      { id: 'b', name: 'אשראי', amount: -12230, when: new Date('2026-10-02') },
      { id: 'c', name: 'משכורת', amount: 24600, when: new Date('2026-10-10') },
    ]
    const peak = peakRequirement(events)
    expect(peak.needed).toBe(17430)
    expect(peak.at.name).toBe('אשראי')
  })

  it('כשההכנסה קודמת, לא צריך להחזיק כלום מראש', async () => {
    const { peakRequirement } = await import('../src/lib/upcoming')
    const peak = peakRequirement([
      { id: 'c', name: 'משכורת', amount: 24600, when: new Date('2026-10-01') },
      { id: 'b', name: 'אשראי', amount: -12230, when: new Date('2026-10-02') },
    ])
    expect(peak.needed).toBe(0)
  })
})

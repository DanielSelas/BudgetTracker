import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { readXlsx } from '../src/lib/xlsx'

/**
 * שני באגים שנמצאו רק על קובץ אמיתי מחברת אשראי, ולכן יש להם
 * בדיקה שמייצרת קובץ באותו מבנה בדיוק.
 */
const NS = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'

const build = () => {
  const shared = `<?xml version="1.0"?><x:sst ${NS}>`
    + '<x:si><x:t>תאריך עסקה</x:t></x:si>'
    + '<x:si><x:t>שם בית עסק</x:t></x:si>'
    + '<x:si><x:t>מנו וינו</x:t></x:si></x:sst>'

  const styles = `<?xml version="1.0"?><x:styleSheet ${NS}>`
    + '<x:numFmts><x:numFmt numFmtId="165" formatCode="[$-,101]d/m/yy;@" /></x:numFmts>'
    + '<x:cellXfs><x:xf numFmtId="0"/><x:xf numFmtId="165"/></x:cellXfs></x:styleSheet>'

  const sheet = `<?xml version="1.0"?><x:worksheet ${NS}><x:sheetData>`
    // שורת כותרת שבה רק התא הראשון מלא, והשאר t="s" בלי ערך
    + '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c>'
    + '<x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="s" /></x:row>'
    + '<x:row r="2"><x:c r="A2" s="1"><x:v>45755</x:v></x:c>'
    + '<x:c r="B2" t="s"><x:v>2</x:v></x:c><x:c r="C2"><x:v>244.9</x:v></x:c></x:row>'
    + '</x:sheetData></x:worksheet>'

  const zip = zipSync({
    'xl/sharedStrings.xml': strToU8(shared),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  })
  return new File([zip], 'real.xlsx')
}

describe('xlsx עם קידומת מרחב שמות', () => {
  it('קורא תגיות שכתובות כ-x:row ולא רק כ-row', async () => {
    const rows = await readXlsx(build())
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe('תאריך עסקה')
    expect(rows[1][1]).toBe('מנו וינו')
  })

  it('תא ריק נשאר ריק ולא מקבל את המחרוזת הראשונה', async () => {
    const rows = await readXlsx(build())
    // זה היה הבאג: t="s" בלי ערך נקרא כ-shared[0]
    expect(rows[0][2]).toBe('')
  })

  it('תאריך בפורמט מותאם מומר, וסכום נשאר מספר', async () => {
    const rows = await readXlsx(build())
    expect(rows[1][0]).toBe('2025-04-08')
    expect(rows[1][2]).toBe('244.9')
  })
})

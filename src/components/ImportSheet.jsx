import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { monthLabel, shekels } from '../lib/format'
import { readAnyFile } from '../lib/readAny'
import { isStaleBuildError } from '../lib/freshBuild'
import {
  byMerchant, detectColumns, extractRows, installmentPlan, mergeFiles, monthsIn,
} from '../lib/importRows'
import { EXPENSE_PILLS } from '../lib/pills'
import { isStanding, suggestCategory } from '../lib/sectors'
import { CURRENCY_LABEL, applyCurrency } from '../lib/currency'

/**
 * ייבוא הוצאות מקובץ.
 *
 * שלושה שלבים: קוראים את הקובץ, מאשרים שהעמודות זוהו נכון, ומסווגים
 * לפי בית עסק. סיווג לפי בית עסק ולא לפי עסקה הוא מה שהופך את זה
 * לבר ביצוע: קובץ של חודש מכיל מאות שורות אבל עשרות בתי עסק, והגדולים
 * שבהם מכסים את רוב הכסף.
 */
const STEPS = { file: 'file', map: 'map', classify: 'classify', done: 'done' }

/**
 * הודעת שגיאה קצרה גם כשנכשלו תשעה עשר קבצים. רשימה מלאה מציפה את
 * המסך ואי אפשר לקרוא ממנה כלום, ושלוש דוגמאות מספיקות כדי להבין.
 */
const summarize = (items, limit = 3) =>
  items.length <= limit
    ? items.join(' | ')
    : `${items.slice(0, limit).join(' | ')} ועוד ${items.length - limit}`

// למה זה מסומן: הצעה בלי הסבר נראית כמו החלטה שרירותית
const SOURCE_NOTE = {
  merchant: 'כלל קבוע לבית העסק הזה',
  standing: 'מסווג כקבוע כי זו הוראת קבע',
  rule: 'מוצע לפי מה שנלמד על הענף',
  seed: 'מוצע לפי הענף',
}

export default function ImportSheet({ sectorRules = {}, onImport, onClose }) {
  const [step, setStep] = useState(STEPS.file)
  // רשימה ולא קובץ בודד: דוח אשראי מכסה תקופת חיוב ולא חודש, ולכן
  // שנה שלמה היא תריסר קבצים ולא אחד
  const [files, setFiles] = useState([])
  const single = files.length === 1
  const [choices, setChoices] = useState({})
  const [rates, setRates] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  const extracted = useMemo(() => {
    const perFile = files.map((file) => {
      const raw = extractRows(file.rows, file.mapping)
      // המרת מטבע נעשית לכל קובץ בנפרד, כי שורת הסיכום שמאמתת
      // אותה שייכת לקובץ שלו
      const money = applyCurrency(raw.rows, { totalsLine: file.totalsLine, rates })
      return { ...raw, ...money, name: file.name }
    })
    const merged = mergeFiles(perFile.map((item) => item.rows))

    const foreign = new Map()
    const needsRates = new Set()
    for (const file of perFile) {
      for (const [currency, amount] of file.foreign) {
        foreign.set(currency, Math.round(((foreign.get(currency) || 0) + amount) * 100) / 100)
      }
      for (const currency of file.needsRates) needsRates.add(currency)
    }

    return {
      rows: merged.rows,
      duplicates: merged.duplicates,
      skipped: perFile.reduce((sum, item) => sum + item.skipped, 0),
      dropped: perFile.reduce((sum, item) => sum + item.dropped, 0),
      unreconciled: perFile.filter((item) => !item.agrees).map((item) => item.name),
      foreign,
      needsRates: [...needsRates],
    }
  }, [files, rates])
  const merchants = useMemo(() => byMerchant(extracted.rows), [extracted.rows])

  /**
   * ההצעה מגיעה מסוג העסקה ומהענף, והבחירה הידנית גוברת עליה. שמירת
   * ההצעה כבחירה מראש הייתה מונעת הבחנה בין "בחרתי" ל"ניחשו בשבילי",
   * וזו בדיוק ההבחנה שקובעת מה נלמד.
   */
  const suggestionOf = (group) => suggestCategory(group, sectorRules)
  const categoryOf = (group) =>
    choices[group.name] ?? suggestionOf(group).category
  const months = useMemo(() => monthsIn(extracted.rows), [extracted.rows])
  const chosen = merchants.filter((group) => categoryOf(group))
  const standingGroups = merchants.filter((group) => isStanding(group.type))
  const unusualGroups = merchants.filter((group) => group.unusual.length > 0)
  // התשלומים הבאים מחושבים על מה שנבחר בפועל, כי מה שלא ייובא גם
  // לא אמור להופיע כהתחייבות
  const plan = useMemo(
    () => installmentPlan(chosen.flatMap((group) => group.rows)),
    [chosen],
  )
  const chosenTotal = chosen.reduce((total, group) => total + group.total, 0)

  const mapping = single ? files[0].mapping : null
  const header = mapping?.headerRow >= 0 ? files[0].rows[mapping.headerRow] : null
  const columnCount = single
    ? Math.max(...files[0].rows.slice(0, 20).map((row) => row.length), 0)
    : 0

  async function pickFiles(event) {
    const picked = [...(event.target.files || [])]
    if (picked.length === 0) return
    setError('')
    setBusy(true)
    const read = []
    const failed = []
    for (const file of picked) {
      try {
        const { rows: parsed } = await readAnyFile(file)
        if (parsed.length === 0) throw new Error('לא נמצאו שורות')
        read.push({
          name: file.name,
          rows: parsed,
          mapping: detectColumns(parsed),
          // שורת הסיכום שבראש הקובץ היא הנתון היחיד שאומר כמה חויב
          // בכל מטבע, ולכן היא נשמרת לצד השורות
          totalsLine: parsed
            .slice(0, 20)
            .map((row) => String(row[0] ?? ''))
            .find((text) => text.includes('סה"כ חיוב')) || '',
        })
      } catch (failure) {
        // גרסה תקועה נכשלת על כל הקבצים באותה סיבה, וזו תקלה של
        // האפליקציה ולא של הקבצים. אין טעם לדווח עליה תשע עשרה פעם
        if (isStaleBuildError(failure)) {
          setBusy(false)
          setError('האפליקציה התעדכנה ברקע. סגרו ופתחו אותה, ונסו שוב.')
          return
        }
        // קובץ אחד פגום לא אמור להפיל העלאה של תריסר. הוא מדווח בשמו
        failed.push(`${file.name}: ${failure?.message || 'לא ניתן לקריאה'}`)
      }
    }
    setBusy(false)
    if (read.length === 0) {
      setError(summarize(failed) || 'לא הצלחתי לקרוא את הקבצים')
      return
    }
    setFiles(read)
    setError(failed.length > 0 ? `דולגו ${failed.length} קבצים. ${summarize(failed)}` : '')
    setStep(STEPS.map)
  }

  // תיקון ידני של עמודה קיים רק בקובץ בודד: בערימת קבצים אין עמודה
  // אחת לתקן, וכל קובץ זוהה בנפרד
  const setColumn = (field, value) =>
    setFiles(([file]) => [{ ...file, mapping: { ...file.mapping, [field]: Number(value) } }])

  async function write() {
    setBusy(true)
    setError('')
    try {
      const entries = chosen.flatMap((group) =>
        group.rows.map((row) => ({ ...row, category: categoryOf(group), groupKey: group.name })),
      )
      // מה שנבחר בפועל נשמר לפי ענף, כך שהקובץ הבא מגיע מסווג.
      // מה שסווג כקבוע רק בגלל שהוא הוראת קבע לא מלמד את הענף: מנוי
      // חדר כושר בהוראת קבע היה מלמד ששורת הפנאי כולה קבועה
      const learned = {}
      for (const group of chosen) {
        if (!group.sector) continue
        const source = suggestionOf(group).source
        // כלל לפי שם והוראת קבע מלמדים על העסק ולא על הענף: עלי
        // אקספרס מגיע תחת מזון ומשקאות, והיה מלמד שהסופר הוא משתנות
        if (!choices[group.name] && (source === 'standing' || source === 'merchant')) continue
        // חיוב חריג מלמד על האירוע ולא על הענף: ניתוח לכלב היה מלמד
        // שכל "רפואה ובריאות" הוא בלת"ם, וכל בית מרקחת אחריו
        if (group.unusual.length > 0) continue
        learned[group.sector] = categoryOf(group)
      }

      const result = await onImport(entries, learned)
      setReport({
        written: result?.written ?? entries.length,
        merchants: chosen.length,
        learned: Object.keys(learned).length,
        standing: standingGroups.length,
        committed: plan.total,
      })
      setStep(STEPS.done)
    } catch {
      setError('הכתיבה נכשלה. אף שורה לא נשמרה')
    }
    setBusy(false)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form">
        <h2>ייבוא הוצאות</h2>

        {step === STEPS.file && (
          <>
            <p className="hint">
              קבצים מחברת האשראי או מהבנק: CSV, XLSX, או קובץ שנקרא
              אקסל ובתוכו טבלה. אפשר לבחור כמה קבצים יחד, והקריאה
              נעשית במכשיר שלכם בלי לשלוח אותם לשום מקום.
            </p>
            <input
              className="input" type="file" multiple
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={pickFiles}
            />
            {busy && <p className="hint">קורא את הקבצים...</p>}
          </>
        )}

        {step === STEPS.map && files.length > 0 && (
          <>
            {single ? (
              <p className="hint">
                ככה הבנתי את הקובץ. אם עמודה זוהתה לא נכון, תקנו כאן.
              </p>
            ) : (
              <>
                <p className="hint">
                  נקראו <strong>{files.length}</strong> קבצים, וכל אחד זוהה
                  בנפרד. עמודות מתקנים ידנית רק בקובץ בודד.
                </p>
                <ul className="timeline">
                  {files.map((file) => (
                    <li className="timeline-row" key={file.name}>
                      <span className="entry-name">{file.name}</span>
                      <span className="entry-amount num">
                        {extractRows(file.rows, file.mapping).rows.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {single && [
              { field: 'date', label: 'תאריך' },
              { field: 'name', label: 'בית עסק' },
              { field: 'amount', label: 'סכום' },
            ].map(({ field, label }) => (
              <label className="field" key={field}>
                {label}
                <select
                  className="input rtl"
                  value={mapping[field]}
                  onChange={(event) => setColumn(field, event.target.value)}
                >
                  <option value={-1}>לא בקובץ</option>
                  {Array.from({ length: columnCount }, (_, index) => (
                    <option key={index} value={index}>
                      {header?.[index] || `עמודה ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <p className="hint">
              נקראו <strong>{extracted.rows.length}</strong> שורות
              {extracted.skipped > 0 && `, ו-${extracted.skipped} דולגו`}.
              {extracted.duplicates > 0 && ` ${extracted.duplicates} שורות הופיעו ביותר מקובץ אחד ואוחדו.`}
              {extracted.skipped > 0 && ' שורות בלי תאריך או בלי סכום, כמו שורות סיכום.'}
              {' '}זיכויים נכללים כסכום שלילי ומקזזים את בית העסק שלהם.
            </p>

            {extracted.foreign.size > 0 && (
              <div className="notice block">
                <p>
                  בקובץ יש חיובים שאינם בשקלים. עמודת המטבע ריקה, ולכן
                  המטבע נגזר משם בית העסק ונבדק מול שורת הסיכום שבראש
                  הקובץ.
                </p>

                <ul className="timeline">
                  {[...extracted.foreign].map(([currency, amount]) => (
                    <li className="timeline-row" key={currency}>
                      <span className="entry-name">
                        {CURRENCY_LABEL[currency] || currency}
                      </span>
                      <span className="entry-amount num">{amount.toLocaleString('he-IL')}</span>
                    </li>
                  ))}
                </ul>

                {[...extracted.foreign.keys()]
                  .filter((currency) => currency !== '?')
                  .map((currency) => (
                    <label className="field" key={currency}>
                      {`כמה שקלים ב${CURRENCY_LABEL[currency] || currency} אחד`}
                      <input
                        className="input num" type="number" inputMode="decimal"
                        min="0" step="0.01" placeholder={currency === 'USD' ? '3.7' : '4'}
                        value={rates[currency] ?? ''}
                        onChange={(event) => setRates((current) => ({
                          ...current, [currency]: event.target.value,
                        }))}
                      />
                    </label>
                  ))}

                {extracted.needsRates.length > 0 && (
                  <p className="hint">
                    בלי שער אי אפשר להמיר, והשורות האלה ייכנסו כאפס.
                    עדיף להזין שער או לחזור בלי הקבצים האלה.
                  </p>
                )}

                {extracted.unreconciled.length > 0 && (
                  <p className="hint">
                    ב{extracted.unreconciled.length === 1 ? 'קובץ אחד' : `-${
                      extracted.unreconciled.length} קבצים`} החלוקה בין
                    המטבעות לא הסתדרה מול שורת הסיכום, ולכן
                    {' '}<strong>{extracted.dropped}</strong> שורות חו״ל מדולגות.
                    המרה לפי ניחוש שגוי הייתה מכניסה סכומים שנראים אמינים
                    ואינם נכונים.
                  </p>
                )}
              </div>
            )}

            {months.length > 0 && (
              <p className="hint">
                {months.length === 1
                  ? `הכל ייכנס ל${monthLabel(months[0])}.`
                  : `כל שורה תיכנס לחודש שלה, מ${monthLabel(months[0])} עד ${
                    monthLabel(months[months.length - 1])}, ${months.length} חודשים.`}
              </p>
            )}

            <div className="sheet-actions">
              <button
                type="button" className="btn-primary"
                disabled={extracted.rows.length === 0}
                onClick={() => setStep(STEPS.classify)}
              >
                המשך
              </button>
              <button type="button" className="btn-secondary" onClick={() => setStep(STEPS.file)}>
                {single ? 'קובץ אחר' : 'קבצים אחרים'}
              </button>
            </div>
          </>
        )}

        {step === STEPS.classify && (
          <>
            <p className="hint">
              מה שסווג לפי סוג העסקה ולפי הענף כבר מסומן. תקנו מה שלא
              מתאים, ומה שנשאר בלי קטגוריה פשוט לא ייובא.
            </p>

            {standingGroups.length > 0 && (
              <p className="hint">
                {standingGroups.length === 1
                  ? 'עסק אחד בקובץ מחויב בהוראת קבע'
                  : `${standingGroups.length} עסקים בקובץ מחויבים בהוראת קבע`}
                , ולכן הם מסומנים כהוצאה קבועה גם אם הענף שלהם אומר אחרת.
              </p>
            )}

            {unusualGroups.length > 0 && (
              <p className="hint">
                {unusualGroups.length === 1
                  ? 'חיוב אחד גבוה בהרבה מהרגיל בחודש הזה'
                  : `${unusualGroups.length} חיובים גבוהים בהרבה מהרגיל בחודש הזה`}
                . הם מסומנים, ואולי מקומם בבלת״ם ולא בקטגוריה הרגילה של הענף.
                מה שתבחרו להם לא ישנה את מה שנלמד על הענף.
              </p>
            )}

            {plan.count > 0 && (
              <div className="notice block">
                <p>
                  ל<strong>{plan.count}</strong> מעסקאות התשלומים יש המשך
                  שלא נמצא בקובץ. לפי התשלום האחרון שמופיע, עוד
                  {' '}<strong>{shekels(plan.total)}</strong> צפויים לרדת:
                </p>
                <ul className="timeline">
                  {plan.byMonth.map((item) => (
                    <li className="timeline-row" key={item.month}>
                      <span className="entry-name">{monthLabel(item.month)}</span>
                      <span className="entry-amount num">{shekels(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="entry-list">
              {merchants.map((group) => (
                <li
                  className="merchant"
                  key={group.name}
                  data-unusual={group.unusual.length > 0 || undefined}
                >
                  <div className="merchant-head">
                    <span className="entry-name">{group.name}</span>
                    <span className="recurring-tag as-tag">
                      {group.rows.length === 1 ? 'עסקה אחת' : `${group.rows.length} עסקאות`}
                    </span>
                    <span className="entry-amount num">{shekels(group.total)}</span>
                  </div>
                  {(group.sector || isStanding(group.type) || group.installment
                    || group.unusual.length > 0) && (
                    <span className="type-hint">
                      {[
                        group.sector,
                        isStanding(group.type) ? 'הוראת קבע' : '',
                        group.installment
                          ? `תשלום ${group.installment.index} מתוך ${group.installment.total}`
                          : '',
                        group.unusual.length > 0
                          ? `חיוב חריג לחודש: ${shekels(Math.max(
                            ...group.unusual.map((row) => row.amount)))}`
                          : '',
                        !choices[group.name] && suggestionOf(group).category
                          ? SOURCE_NOTE[suggestionOf(group).source]
                          : '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <div className="cat-pills tight">
                    {EXPENSE_PILLS.map((pill) => (
                      <button
                        key={pill.category}
                        type="button"
                        className="cat-pill"
                        data-category={pill.category}
                        aria-pressed={categoryOf(group) === pill.category}
                        onClick={() => setChoices((current) => ({
                          ...current,
                          [group.name]: current[group.name] === pill.category
                            ? undefined
                            : pill.category,
                        }))}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            {error && <p className="notice block" role="alert">{error}</p>}

            <div className="sheet-actions">
              <button
                type="button" className="btn-primary"
                disabled={chosen.length === 0 || busy}
                onClick={write}
              >
                {busy ? 'מייבא...' : `ייבוא ${shekels(chosenTotal)}`}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setStep(STEPS.map)}>
                חזרה
              </button>
            </div>
          </>
        )}

        {step === STEPS.done && report && (
          <>
            <p className="hint">
              יובאו <strong>{report.written}</strong> שורות
              מ-<strong>{report.merchants}</strong> בתי עסק. כל בית עסק מופיע
              בכרטיס שלו כשורה אחת מכווצת, ואפשר לפתוח אותה לפירוט.
            </p>
            {report.learned > 0 && (
              <p className="hint">
                נלמדו <strong>{report.learned}</strong> ענפים. בקובץ הבא
                הם יגיעו מסווגים מראש, גם בעסקים שלא ראיתם עדיין.
              </p>
            )}
            {report.standing > 0 && (
              <p className="hint">
                <strong>{report.standing}</strong> מהעסקים מחויבים בהוראת קבע.
                אלה מועמדים טבעיים לחיוב קבוע עם תאריך, וכך הם ייכנסו גם
                לציר החיובים הקרובים ולא רק לסיכום החודש.
              </p>
            )}
            {report.committed > 0 && (
              <p className="hint">
                <strong>{shekels(report.committed)}</strong> צפויים לרדת
                בהמשך תוכניות התשלומים. הם לא בתקציב של החודש הזה, אבל הם
                כבר התחייבות, וכדאי לזכור אותם כשמתכננים את החודשים הבאים.
              </p>
            )}
            <p className="hint">
              שורות שכבר קיימות מייבוא קודם נכתבו מחדש ולא שוכפלו, אז
              אפשר לייבא שוב את אותו קובץ בלי חשש.
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn-primary" onClick={onClose}>סיום</button>
            </div>
          </>
        )}

        {step === STEPS.file && error && (
          <p className="notice block" role="alert">{error}</p>
        )}

        <p className="hint">
          החודש של כל שורה נקבע לפי התאריך שבקובץ, ולא לפי החודש
          שפתוח עכשיו.
        </p>
      </div>
    </Sheet>
  )
}

import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { monthLabel, shekels } from '../lib/format'
import { readAnyFile } from '../lib/readAny'
import { byMerchant, detectColumns, extractRows, installmentPlan, monthsIn } from '../lib/importRows'
import { EXPENSE_PILLS } from '../lib/pills'
import { isStanding, suggestCategory } from '../lib/sectors'

/**
 * ייבוא הוצאות מקובץ.
 *
 * שלושה שלבים: קוראים את הקובץ, מאשרים שהעמודות זוהו נכון, ומסווגים
 * לפי בית עסק. סיווג לפי בית עסק ולא לפי עסקה הוא מה שהופך את זה
 * לבר ביצוע: קובץ של חודש מכיל מאות שורות אבל עשרות בתי עסק, והגדולים
 * שבהם מכסים את רוב הכסף.
 */
const STEPS = { file: 'file', map: 'map', classify: 'classify', done: 'done' }

// למה זה מסומן: הצעה בלי הסבר נראית כמו החלטה שרירותית
const SOURCE_NOTE = {
  standing: 'מסווג כקבוע כי זו הוראת קבע',
  rule: 'מוצע לפי מה שנלמד על הענף',
  seed: 'מוצע לפי הענף',
}

export default function ImportSheet({ sectorRules = {}, onImport, onClose }) {
  const [step, setStep] = useState(STEPS.file)
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState(null)
  const [choices, setChoices] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  const extracted = useMemo(
    () => (mapping ? extractRows(rows, mapping) : { rows: [], skipped: 0 }),
    [rows, mapping],
  )
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

  const header = mapping?.headerRow >= 0 ? rows[mapping.headerRow] : null
  const columnCount = Math.max(...rows.slice(0, 20).map((row) => row.length), 0)

  async function pickFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const { rows: parsed } = await readAnyFile(file)
      if (parsed.length === 0) throw new Error('הקובץ נקרא אבל לא נמצאו בו שורות')
      setRows(parsed)
      setMapping(detectColumns(parsed))
      setStep(STEPS.map)
    } catch (failure) {
      // הסיבה האמיתית ולא הודעה כללית: בלי זה אי אפשר לדעת אם הקובץ
      // בפורמט אחר, פגום, או פשוט ריק
      setError(failure?.message || 'לא הצלחתי לקרוא את הקובץ')
    }
  }

  const setColumn = (field, value) =>
    setMapping((current) => ({ ...current, [field]: Number(value) }))

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
        if (!choices[group.name] && suggestionOf(group).source === 'standing') continue
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
              קובץ מחברת האשראי או מהבנק: CSV, XLSX, או קובץ שנקרא
              אקסל ובתוכו טבלה. הקריאה נעשית במכשיר שלכם, והקובץ לא
              נשלח לשום מקום.
            </p>
            <input className="input" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pickFile} />
          </>
        )}

        {step === STEPS.map && mapping && (
          <>
            <p className="hint">
              ככה הבנתי את הקובץ. אם עמודה זוהתה לא נכון, תקנו כאן.
            </p>

            {[
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
              {extracted.skipped > 0 && ' שורות בלי תאריך או בלי סכום, כמו שורות סיכום.'}
              {' '}זיכויים נכללים כסכום שלילי ומקזזים את בית העסק שלהם.
            </p>

            {months.length > 0 && (
              <p className="hint">
                {months.length === 1
                  ? `הכל ייכנס ל${monthLabel(months[0])}.`
                  : `הקובץ חוצה חודשים, וכל שורה תיכנס לחודש שלה: ${
                    months.map(monthLabel).join(', ')}.`}
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
                קובץ אחר
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

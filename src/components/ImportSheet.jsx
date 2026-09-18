import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { parseCsv, readText } from '../lib/csv'
import { byMerchant, detectColumns, extractRows } from '../lib/importRows'
import { EXPENSE_PILLS } from '../lib/pills'

/**
 * ייבוא הוצאות מקובץ.
 *
 * שלושה שלבים: קוראים את הקובץ, מאשרים שהעמודות זוהו נכון, ומסווגים
 * לפי בית עסק. סיווג לפי בית עסק ולא לפי עסקה הוא מה שהופך את זה
 * לבר ביצוע: קובץ של חודש מכיל מאות שורות אבל עשרות בתי עסק, והגדולים
 * שבהם מכסים את רוב הכסף.
 */
const STEPS = { file: 'file', map: 'map', classify: 'classify', done: 'done' }

export default function ImportSheet({ month, onImport, onClose }) {
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
  const chosen = merchants.filter((group) => choices[group.name])
  const chosenTotal = chosen.reduce((total, group) => total + group.total, 0)

  const header = mapping?.headerRow >= 0 ? rows[mapping.headerRow] : null
  const columnCount = Math.max(...rows.slice(0, 20).map((row) => row.length), 0)

  async function pickFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const parsed = parseCsv(await readText(file))
      if (parsed.length === 0) throw new Error('הקובץ ריק')
      setRows(parsed)
      setMapping(detectColumns(parsed))
      setStep(STEPS.map)
    } catch {
      setError('לא הצלחתי לקרוא את הקובץ. ודאו שזה CSV')
    }
  }

  const setColumn = (field, value) =>
    setMapping((current) => ({ ...current, [field]: Number(value) }))

  async function write() {
    setBusy(true)
    setError('')
    try {
      const entries = chosen.flatMap((group) =>
        group.rows.map((row) => ({ ...row, category: choices[group.name], groupKey: group.name })),
      )
      const result = await onImport(entries)
      setReport({ written: result?.written ?? entries.length, merchants: chosen.length })
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
              קובץ CSV מחברת האשראי או מהבנק. הקריאה נעשית במכשיר שלכם,
              והקובץ לא נשלח לשום מקום.
            </p>
            <input className="input" type="file" accept=".csv,text/csv" onChange={pickFile} />
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
              בחרו קטגוריה לכל בית עסק, מהגדול לקטן. מה שלא תבחרו פשוט
              לא ייובא, ואפשר לחזור לזה בפעם אחרת.
            </p>

            <ul className="entry-list">
              {merchants.map((group) => (
                <li className="merchant" key={group.name}>
                  <div className="merchant-head">
                    <span className="entry-name">{group.name}</span>
                    <span className="recurring-tag as-tag">
                      {group.rows.length === 1 ? 'עסקה אחת' : `${group.rows.length} עסקאות`}
                    </span>
                    <span className="entry-amount num">{shekels(group.total)}</span>
                  </div>
                  <div className="cat-pills tight">
                    {EXPENSE_PILLS.map((pill) => (
                      <button
                        key={pill.category}
                        type="button"
                        className="cat-pill"
                        data-category={pill.category}
                        aria-pressed={choices[group.name] === pill.category}
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
          החודש שאליו ייכנסו השורות נקבע לפי התאריך שבקובץ, ולא לפי
          החודש שפתוח עכשיו ({month}).
        </p>
      </div>
    </Sheet>
  )
}

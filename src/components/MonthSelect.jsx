import { useEffect, useRef, useState } from 'react'
import { MONTH_NAMES, monthLabel } from '../lib/format'
import { monthKey, shiftMonth } from '../lib/model'

/**
 * בורר חודשים.
 *
 * input type="month" אינו נתמך בספארי במחשב ובפיירפוקס, ושם הוא
 * נופל לשדה טקסט חופשי: אין בורר, אין רמז, ומי שרואה אותו לא יודע
 * מה להקליד. גם רשימה נפתחת של ארבעים חודשים אינה תשובה טובה.
 *
 * זה לוח של שנה אחת, בלי ימים: הבחירה כאן היא חודש, ולוח ימים היה
 * מבקש מידע שאין לו משמעות. השנה מתחלפת בחצים, ולכן שנתיים אחורה
 * הן שתי לחיצות ולא גלילה ארוכה.
 */
const yearOf = (key) => Number(String(key).split('-')[0])
const keyOf = (year, index) => `${year}-${String(index + 1).padStart(2, '0')}`

export default function MonthSelect({
  value, onChange, from, until, allowEmpty = false,
  emptyLabel = 'בלי תאריך סיום', label = 'בחירת חודש',
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(yearOf(value || from || monthKey()))
  const box = useRef(null)
  const pop = useRef(null)

  // פתיחה חוזרת מתחילה מהחודש שנבחר, ולא מהשנה שנשארה מהפעם הקודמת
  useEffect(() => {
    if (open) setYear(yearOf(value || from || monthKey()))
  }, [open, value, from])

  // המגירה נגללת, ולכן לוח שנפתח קרוב לתחתית נשאר מחוץ לשדה הראייה
  useEffect(() => {
    if (open) pop.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    const onClick = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const pick = (key) => { onChange(key); setOpen(false) }
  // חודש שכבר שמור נשאר בר בחירה גם אם הוא מחוץ לטווח, אחרת פתיחת
  // המסך הייתה מוחקת את הבחירה הקיימת
  const blocked = (key) =>
    key !== value && ((from && key < from) || (until && key > until))

  return (
    <div className="month-select" ref={box}>
      <button
        type="button"
        className="input month-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((on) => !on)}
      >
        {value ? monthLabel(value) : emptyLabel}
      </button>

      {open && (
        <div className="month-pop" role="dialog" aria-label={label} ref={pop}>
          <div className="month-pop-head">
            {/* בעברית הזמן זורם ימינה אחורה, כמו בבורר החודש הראשי */}
            <button
              type="button" className="btn-round sm" aria-label="שנה קודמת"
              onClick={() => setYear((current) => current - 1)}
            >
              →
            </button>
            <span className="num">{year}</span>
            <button
              type="button" className="btn-round sm" aria-label="שנה הבאה"
              onClick={() => setYear((current) => current + 1)}
            >
              ←
            </button>
          </div>

          <div className="month-grid">
            {MONTH_NAMES.map((name, index) => {
              const key = keyOf(year, index)
              return (
                <button
                  key={key}
                  type="button"
                  className="month-cell"
                  aria-pressed={key === value}
                  disabled={blocked(key)}
                  onClick={() => pick(key)}
                >
                  {name}
                </button>
              )
            })}
          </div>

          {allowEmpty && (
            <button type="button" className="btn-text" onClick={() => pick('')}>
              {emptyLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

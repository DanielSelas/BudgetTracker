import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { countTemplateEntries, deleteTemplateEverywhere, stopTemplate } from '../lib/recurring'

/**
 * הפסקה של חיוב קבוע, בשתי דרגות.
 *
 * הפסקה משאירה את ההיסטוריה, וזה הנכון לחיוב שבאמת היה: שכירות
 * שהסתיימה עדיין קרתה, והחודשים שבהם שולמה אמורים להראות אותה.
 * מחיקה מלאה קיימת בשביל תבנית שנוצרה בטעות, שמשאירה שורה בכל חודש
 * שנפתח מאז.
 *
 * מספר השורות מוצג לפני הבחירה, כי בלעדיו אי אפשר לדעת מה ההבדל
 * בפועל בין שתי האפשרויות.
 */
export default function StopRecurring({ template, budgetId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(null)

  // מהשורה של החודש מגיע recurringId, וממסך החיובים הקבועים מגיעה
  // התבנית עצמה שהמזהה שלה הוא id. קריאה לאחד בלבד נכשלה בשקט
  const id = template.recurringId || template.id

  useEffect(() => {
    let live = true
    countTemplateEntries(budgetId, id)
      .then((result) => { if (live) setCount(result) })
      .catch(() => { if (live) setCount(null) })
    return () => { live = false }
  }, [budgetId, id])

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action(budgetId, id)
      onDone()
    } catch (failure) {
      setError(failure?.message || 'הפעולה נכשלה')
      setBusy(false)
    }
  }

  const rows = count?.rows ?? 0

  return (
    <Sheet onClose={onDone}>
      <div className="sheet-form">
        <h2>{template.name}</h2>

        {count === null ? (
          <p className="hint">בודק כמה שורות תלויות בחיוב הזה...</p>
        ) : (
          <p className="hint">
            {rows === 0
              ? 'אין שורות שנוצרו מהחיוב הזה.'
              : `נוצרו ממנו ${rows === 1 ? 'שורה אחת' : `${rows} שורות`} ב${
                count.months === 1 ? 'חודש אחד' : `-${count.months} חודשים`}.`}
          </p>
        )}

        {error && <p className="notice block" role="alert">{error}</p>}

        <div className="sheet-actions">
          <button
            type="button" className="btn-primary" disabled={busy}
            onClick={() => run(stopTemplate)}
          >
            {busy ? 'רגע...' : 'הפסקה, בלי למחוק היסטוריה'}
          </button>

          <button
            type="button" className="btn-danger" disabled={busy}
            onClick={() => run(deleteTemplateEverywhere)}
          >
            {rows > 0 ? `מחיקה, כולל ${rows} השורות` : 'מחיקה מלאה'}
          </button>

          <button type="button" className="btn-secondary" onClick={onDone}>ביטול</button>
        </div>

        <span className="type-hint">
          הפסקה מונעת את החיוב מהחודש הבא והלאה, והשורות שכבר נוצרו
          נשארות ונשארות גם בסכום החודשי. מחיקה מוחקת גם אותן, מכל
          החודשים, ואי אפשר לבטל אותה.
        </span>
      </div>
    </Sheet>
  )
}

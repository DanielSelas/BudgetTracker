import { useState } from 'react'
import Sheet from './Sheet'
import { deleteTemplateEverywhere, stopTemplate } from '../lib/recurring'

/**
 * הפסקה של חיוב קבוע, בשתי דרגות.
 *
 * הפסקה משאירה את ההיסטוריה, וזה הנכון לחיוב שבאמת היה: שכירות
 * שהסתיימה עדיין קרתה. מחיקה מלאה קיימת בשביל תבנית שנוצרה בטעות,
 * שמשאירה שורה בכל חודש שנפתח מאז, ואי אפשר לצפות ממישהו למחוק
 * אותן אחת אחת.
 */
export default function StopRecurring({ template, budgetId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // מהשורה של החודש מגיע recurringId, וממסך החיובים הקבועים מגיעה
  // התבנית עצמה שהמזהה שלה הוא id. קריאה לאחד בלבד נכשלה בשקט
  const id = template.recurringId || template.id

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

  return (
    <Sheet onClose={onDone}>
      <div className="sheet-form">
        <h2>{template.name}</h2>

        <p className="hint">
          הפסקה מונעת את החיוב מהחודש הבא והלאה, והשורות שכבר נוצרו
          נשארות. מחיקה מלאה מוחקת גם אותן, מכל החודשים, ואי אפשר
          לבטל אותה.
        </p>

        {error && <p className="notice block" role="alert">{error}</p>}

        <div className="sheet-actions">
          <button
            type="button" className="btn-primary" disabled={busy}
            onClick={() => run(stopTemplate)}
          >
            {busy ? 'רגע...' : 'הפסקה מהחודש הבא'}
          </button>
          <button
            type="button" className="btn-danger" disabled={busy}
            onClick={() => run(deleteTemplateEverywhere)}
          >
            מחיקה מכל החודשים
          </button>
          <button type="button" className="btn-secondary" onClick={onDone}>ביטול</button>
        </div>
      </div>
    </Sheet>
  )
}

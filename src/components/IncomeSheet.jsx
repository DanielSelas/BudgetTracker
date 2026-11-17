import Sheet from './Sheet'
import EntryItems from './EntryItems'
import { monthLabel, shekels } from '../lib/format'

/**
 * ההכנסות של החודש.
 *
 * אין להן כרטיס במסך: הכנסה אינה דבר שמנהלים מול יעד, וככרטיס היא
 * דחפה את שלוש הקטגוריות האמיתיות מטה. אבל בלי שום מסך השורות עצמן
 * נעלמו, ומשכורת שהוקלדה בסכום לא נכון לא הייתה ניתנת לתיקון בשום
 * מקום. האריח בסיכום הוא הדלת אליהן, כמו שאריח סכום הבסיס לידו
 * פותח את ההגדרה שלו.
 */
export default function IncomeSheet({
  month, entries = [], authorOf, actions, onAdd, onStopRecurring, onClose,
}) {
  const total = entries.reduce((sum, entry) => sum + (entry.actualAmount || 0), 0)

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form">
        <h2>הכנסות ב{monthLabel(month)}</h2>

        {entries.length > 0 ? (
          <>
            <EntryItems
              entries={entries}
              authorOf={authorOf}
              actions={actions}
              categories={[]}
              onStopRecurring={onStopRecurring}
            />

            <p className="sheet-total">
              <span>סך הכל</span>
              <span className="num">{shekels(total)}</span>
            </p>
          </>
        ) : (
          <p className="empty">בחודש הזה עוד לא הוזנה הכנסה.</p>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn-primary" onClick={onAdd}>+ הוספת הכנסה</button>
          <button type="button" className="btn-secondary" onClick={onClose}>סגירה</button>
        </div>

        <p className="hint">
          ההכנסה אינה נמדדת מול יעד, ולכן אין לה כרטיס במסך החודש. ממנה
          נגזר סכום הבסיס, וכל מה שנכנס מעליו מופיע כיתרה.
        </p>
      </div>
    </Sheet>
  )
}

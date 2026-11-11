import { useState } from 'react'
import { shekels } from '../lib/format'
import { EXPENSE_PILLS } from '../lib/pills'
import { CATEGORIES, todayDate } from '../lib/model'

/**
 * מה שנקלט וממתין לאישור.
 *
 * הכרטיס הראשון במסך, לפני הסיכום, כי זה הדבר היחיד שדורש פעולה.
 * שורה עם קטגוריה מנוחשת אפשר לאשר בלחיצה אחת; שורה בלי ניחוש
 * דורשת לבחור, וזו בדיוק הלחיצה שמלמדת את האפליקציה להבא.
 */
// יום וחודש בלבד: השנה אינה מוסיפה כלום לשורה שנקלטה השבוע
const dayLabel = (date) => {
  const [, month, day] = String(date || '').split('-')
  return month && day ? `${Number(day)}.${Number(month)}` : ''
}

export default function InboxCard({ items = [], onApprove, onDismiss }) {
  const today = todayDate()
  // הבחירה היא מקומית ולא נכתבת: היא חיה שניות עד האישור, וכתיבה
  // שלה ל-Firestore הייתה סיבוב רשת על כל נגיעה בגלולה
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState('')

  if (items.length === 0) return null

  const categoryOf = (item) => picked[item.id] || item.suggestedCategory || ''

  async function approve(item) {
    const category = categoryOf(item)
    if (!category || busy) return
    setBusy(item.id)
    try {
      await onApprove(item, category)
    } finally {
      setBusy('')
    }
  }

  const ready = items.filter((item) => categoryOf(item))

  return (
    <section className="inbox-card">
      <h2>
        {items.length === 1 ? 'הוצאה ממתינה' : `${items.length} הוצאות ממתינות`}
      </h2>

      <ul className="inbox-list">
        {items.map((item) => {
          const category = categoryOf(item)
          return (
            <li className="inbox-row" key={item.id}>
              <div className="inbox-head">
                <span className="entry-name">{item.name}</span>
                {/* היום הוא ברירת המחדל ולכן אינו נאמר; יום אחר כן,
                    כי הוא קובע לאיזה חודש השורה תיזקף */}
                {item.date !== today && (
                  <span className="inbox-when num">{dayLabel(item.date)}</span>
                )}
                <span className="entry-amount num">{shekels(item.amount)}</span>
              </div>

              <div className="cat-pills tight">
                {EXPENSE_PILLS.map((pill) => (
                  <button
                    key={pill.category}
                    type="button"
                    className="cat-pill"
                    data-category={pill.category}
                    aria-pressed={category === pill.category}
                    onClick={() => setPicked((current) => ({ ...current, [item.id]: pill.category }))}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="inbox-actions">
                <button
                  type="button"
                  className="btn-primary slim"
                  disabled={!category || busy === item.id}
                  onClick={() => approve(item)}
                >
                  {category
                    ? `אישור ל${CATEGORIES[category].short || CATEGORIES[category].label}`
                    : 'בחרו קטגוריה'}
                </button>
                <button
                  type="button"
                  className="btn-text danger-text"
                  disabled={Boolean(busy)}
                  onClick={() => onDismiss(item)}
                >
                  התעלמות
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {ready.length > 1 && (
        <button
          type="button"
          className="btn-text"
          disabled={Boolean(busy)}
          onClick={async () => {
            setBusy('all')
            try {
              // בזו אחר זו ולא במקביל: כל אישור הוא כתיבה אטומית
              // משלו, וכשל באמצע משאיר את מה שלא אושר בתיבה
              for (const item of ready) await onApprove(item, categoryOf(item))
            } finally {
              setBusy('')
            }
          }}
        >
          אישור {ready.length} השורות שסווגו
        </button>
      )}

      <p className="hint">
        מה שנקלט מהקיצור בטלפון ממתין כאן ואינו נספר בתקציב עד האישור.
        הקטגוריה שתבחרו נזכרת, וההוצאה הבאה מאותו מקום תגיע מסווגת.
      </p>
    </section>
  )
}

import { useState } from 'react'
import { dayMonth, shekels } from '../lib/format'
import { EXPENSE_PILLS } from '../lib/pills'
import { CATEGORIES, todayDate } from '../lib/model'

/**
 * מה שנקלט וממתין לאישור.
 *
 * הכרטיס הראשון במסך, לפני הסיכום, כי זה הדבר היחיד שדורש פעולה.
 * שורה עם קטגוריה מנוחשת אפשר לאשר בלחיצה אחת; שורה בלי ניחוש
 * דורשת לבחור.
 *
 * והשיוך לקבוצה הוא החלק השני: קנייה בסופר אינה שורה חדשה במסך אלא
 * עוד חיוב בתוך חיוב קיים. בלי זה כל קנייה הייתה שורה נפרדת, וחודש
 * של קניות היה מציף את הכרטיס ומסתיר את כל השאר.
 */

export default function InboxCard({ items = [], groups = [], onApprove, onDismiss }) {
  const today = todayDate()
  // הבחירה מקומית ולא נכתבת: היא חיה שניות עד האישור, וכתיבה שלה
  // ל-Firestore הייתה סיבוב רשת על כל נגיעה בגלולה
  const [picked, setPicked] = useState({})
  const [attached, setAttached] = useState({})
  const [busy, setBusy] = useState('')

  if (items.length === 0) return null

  const groupOf = (item) =>
    (item.id in attached ? attached[item.id] : item.groupKey) || ''

  const categoryOf = (item) => {
    if (picked[item.id]) return picked[item.id]
    // שיוך לקבוצה קיימת גורר את הקטגוריה שלה, כי "זה הולך עם הסופר"
    // כבר אומר לאן זה נספר. זו אינה למידה מההיסטוריה אלא תוצאה
    // ישירה של בחירה שנעשתה עכשיו, ואפשר לשנות אותה מיד אחריה
    const group = groups.find((option) => option.key === groupOf(item))
    return group?.category || item.suggestedCategory || ''
  }

  async function approve(item) {
    const category = categoryOf(item)
    if (!category || busy) return
    setBusy(item.id)
    try {
      await onApprove(item, category, groupOf(item))
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
          const group = groupOf(item)
          // הקבוצה שנגזרה מהשם מוצעת גם כשהיא עוד לא קיימת החודש
          const options = groups.some((option) => option.key === item.groupKey)
            ? groups
            : [...(item.groupKey ? [{ key: item.groupKey, total: 0 }] : []), ...groups]

          return (
            <li className="inbox-row" key={item.id}>
              <div className="inbox-head">
                {/* היום הוא ברירת המחדל ולכן אינו נאמר; יום אחר כן,
                    כי הוא קובע לאיזה חודש השורה תיזקף */}
                <span className="entry-name">{item.name}</span>
                {item.date !== today && (
                  <span className="inbox-when num">{dayMonth(item.date)}</span>
                )}
                <span className="entry-amount num">{shekels(item.amount)}</span>
              </div>

              {options.length > 0 && (
                <>
                  <span className="inbox-label">לצרף לחיוב קיים</span>
                  <div className="group-chips">
                    <button
                      type="button"
                      className="cat-pill"
                      aria-pressed={!group}
                      onClick={() => setAttached((current) => ({ ...current, [item.id]: '' }))}
                    >
                      שורה בפני עצמה
                    </button>
                    {options.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className="cat-pill"
                        aria-pressed={group === option.key}
                        onClick={() => setAttached((current) => ({ ...current, [item.id]: option.key }))}
                      >
                        {option.key}
                        {option.total > 0 && (
                          <span className="chip-total num">{shekels(option.total)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}

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
                    ? group
                      ? `אישור, לתוך ${group}`
                      : `אישור ל${CATEGORIES[category].short || CATEGORIES[category].label}`
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
              for (const item of ready) {
                await onApprove(item, categoryOf(item), groupOf(item))
              }
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
        צירוף לחיוב קיים מכניס את השורה לתוכו במקום לפתוח לה שורה חדשה.
      </p>
    </section>
  )
}

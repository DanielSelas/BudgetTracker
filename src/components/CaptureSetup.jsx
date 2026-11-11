import { useState } from 'react'
import Sheet from './Sheet'
import { rotateCaptureToken } from '../lib/budgets'

/**
 * הכתובת שמדביקים לקיצור בטלפון.
 *
 * המסך הזה קיים כי אסימון הוא דבר שאי אפשר להקליד נכון. הוא מראה
 * כתובת אחת מוכנה להעתקה, ולא אסימון שצריך להרכיב סביבו משהו.
 *
 * האסימון אינו נוצר מאליו עם התקציב אלא בלחיצה, כדי שלמי שלא
 * משתמש בקליטה מהטלפון לא יהיה אסימון פעיל שהוא לא ביקש.
 */
export default function CaptureSetup({ budgetId, token, onClose }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [rotating, setRotating] = useState(false)

  // האסימון בלבד בכתובת, והטקסט בגוף הבקשה. רווח בכתובת שאינה
  // מקודדת חותך את כל מה שאחריו, וכך הסכום נעלם בדרך
  const url = token ? `${window.location.origin}/api/capture?token=${token}` : ''

  async function create() {
    setBusy(true)
    setFailed(false)
    try {
      await rotateCaptureToken(budgetId)
      setRotating(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // דפדפן שחוסם את הלוח אינו תקלה שאפשר לתקן כאן, והטקסט ממילא
      // מוצג ואפשר לסמן אותו ידנית
      setFailed(true)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2>קליטה מהטלפון</h2>

      <p className="hint">
        קיצור ב-iOS ששולח הוצאה בלי לפתוח דפדפן. שאלה אחת, באנר, ואתם
        נשארים איפה שהייתם. ההוצאה ממתינה בתיבה עד שתאשרו.
      </p>

      {!token ? (
        <>
          <p className="hint">
            הכתובת נוצרת פעם אחת ונשארת. היא מרשה דבר אחד בלבד: ליצור
            שורה ממתינה בתיבה. לא לקרוא, לא לכתוב רשומות ולא לראות
            מספר אחד.
          </p>
          <button type="button" className="btn-primary" disabled={busy} onClick={create}>
            {busy ? 'יוצר' : 'יצירת כתובת'}
          </button>
        </>
      ) : (
        <>
          <p className="code-block ltr" dir="ltr">{url}</p>

          <button type="button" className="btn-primary" onClick={copy}>
            {copied ? 'הועתק' : 'העתקת הכתובת'}
          </button>

          <ol className="steps">
            <li><strong>Ask for Input</strong>, סוג Text</li>
            <li><strong>Get Contents of URL</strong> עם הכתובת הזו</li>
            <li><strong>Method</strong>: POST</li>
            <li>
              <strong>Request Body</strong>: JSON ← Add new field ← Text,
              מפתח <code>add</code>, וכערך גוררים את Provided Input
            </li>
          </ol>

          <p className="hint">
            הטקסט נכנס לגוף הבקשה ולא לכתובת, כי רווח בתוך כתובת חותך
            את כל מה שאחריו. בלי Open URLs, וזה מה שמשאיר את הדפדפן סגור.
          </p>

          {!rotating ? (
            <button type="button" className="btn-text danger-text" onClick={() => setRotating(true)}>
              החלפת הכתובת
            </button>
          ) : (
            <>
              <p className="notice block">
                כתובת חדשה מבטלת את הקודמת. כל קיצור שמחזיק אותה יפסיק
                לעבוד עד שתעדכנו אותו.
              </p>
              <button type="button" className="btn-secondary" disabled={busy} onClick={create}>
                {busy ? 'מחליף' : 'החלפה'}
              </button>
              <button type="button" className="btn-text" onClick={() => setRotating(false)}>
                ביטול
              </button>
            </>
          )}
        </>
      )}

      {failed && (
        <p className="notice block" role="alert">
          משהו נכשל. נסו שוב, ואם הכתובת מוצגת אפשר לסמן אותה ידנית.
        </p>
      )}
    </Sheet>
  )
}

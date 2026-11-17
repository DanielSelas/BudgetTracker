import { useMemo, useState } from 'react'
import { dayMonth, shekels, stampDay } from '../lib/format'
import { displayName } from '../lib/members'
import { MAX_GROUP_LENGTH, normalizeGroup } from '../lib/groups'

/**
 * שורה בכרטיס קטגוריה, ועריכה שלה במקום.
 *
 * קודם אפשר היה לערוך רק את הסכום, ולכן תיקון שם או קטגוריה חייב
 * מחיקה והזנה מחדש. בשורה שנוצרה מחיוב קבוע זה היה גרוע במיוחד:
 * המחיקה מדלגת על החודש בתבנית, כך שמי שרק רצה לתקן שם גרם לשורה
 * לא לחזור, בלי שאמרו לו.
 */
export default function EntryRow({
  entry, author, categories = [], groups = [], samePlace,
  onUpdate, onRemove, onStopRecurring,
}) {
  const [editing, setEditing] = useState(false)
  const [actual, setActual] = useState(String(entry.actualAmount ?? 0))
  const [name, setName] = useState(entry.name || '')
  const [category, setCategory] = useState(entry.category)
  const [oneOff, setOneOff] = useState(Boolean(entry.oneOff))
  const [note, setNote] = useState(entry.note || '')
  const [group, setGroup] = useState(normalizeGroup(entry.groupKey))
  const [alsoPlace, setAlsoPlace] = useState(false)
  const [busy, setBusy] = useState(false)

  // השורות האחרות מאותו מקום, שעוד לא קובצו. נקראות רק כשהעריכה
  // פתוחה, כי זו השאלה שנשאלת שם ולא בכל שורה במסך
  const others = useMemo(
    () => (editing && samePlace ? samePlace(entry) : []), [editing, samePlace, entry])

  function open() {
    setActual(String(entry.actualAmount ?? 0))
    setName(entry.name || '')
    setCategory(entry.category)
    setOneOff(Boolean(entry.oneOff))
    setNote(entry.note || '')
    setGroup(normalizeGroup(entry.groupKey))
    setAlsoPlace(false)
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const changes = { actualAmount: Number(actual) || 0 }
      const trimmed = name.trim()
      if (trimmed && trimmed !== entry.name) changes.name = trimmed
      if (category !== entry.category) changes.category = category
      if (oneOff !== Boolean(entry.oneOff)) changes.oneOff = oneOff
      if (note.trim() !== (entry.note || '')) changes.note = note.trim()
      const key = normalizeGroup(group)
      if (key !== normalizeGroup(entry.groupKey)) changes.groupKey = key
      await onUpdate(entry.id, changes)
      // האחרות אחרי השורה שנערכה ובאותו שם, כדי שהקבוצה תיראה
      // בבת אחת ולא תיבנה שורה שורה לעיני המשתמש
      if (key && alsoPlace) {
        for (const other of others) await onUpdate(other.id, { groupKey: key })
      }
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  /**
   * שני תאריכים שונים, ולכן לא תמיד שניהם.
   *
   * date הוא מתי ההוצאה קרתה, ו-addedAt הוא מתי השורה נכנסה
   * לאפליקציה. בהזנה ידנית ובקליטה מהטלפון הם אותו יום, ואז אומרים
   * אותו פעם אחת. בשורה מיובאת הם נפרדים: הקנייה הייתה ב-3.9
   * והקובץ עלה ב-11.11, ואז שווה להגיד את שניהם.
   *
   * שורות ישנות ושורות שנוצרו מתבנית אין להן אף אחד מהם, ואז אין
   * מה להציג. תאריך מומצא גרוע מהיעדרו.
   */
  const happened = dayMonth(entry.date)
  const added = stampDay(entry.addedAt)
  const when = happened
    ? (added && added !== happened ? `${happened} · נוסף ${added}` : happened)
    : (added ? `נוסף ${added}` : '')

  // שורה מסכמת של טיול או מטרה נגזרת ממקום אחר, ולכן היא לקריאה בלבד
  if (entry.linkedTripId) {
    return (
      <li className="entry-row">
        <span className="entry-name">{entry.name}</span>
        <span className="recurring-tag as-tag">מקושר</span>
        <span className="entry-amount num">{shekels(entry.actualAmount)}</span>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="entry-row editing">
        <form className="row-edit" onSubmit={save}>
          <input
            className="input"
            maxLength={100}
            value={name}
            placeholder="שם השורה"
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />

          {categories.length > 1 && (
            <div className="cat-pills tight">
              {categories.map((option) => (
                <button
                  key={option.category}
                  type="button"
                  className="cat-pill"
                  data-category={option.category}
                  aria-pressed={category === option.category}
                  onClick={() => setCategory(option.category)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* הסימון קיים כדי שהוצאה חריגה לא תלמד מה חודש רגיל עולה,
              והוא נמדד על הוצאות בלבד. בהכנסה הוא לא השפיע על דבר,
              וגם כתב "הוצאה" על שורת משכורת */}
          {category !== 'income' && (
            <button
              type="button"
              className="recur-toggle"
              aria-pressed={oneOff}
              onClick={() => setOneOff((on) => !on)}
            >
              הוצאה חד פעמית
              <span className="switch"><span className="knob" /></span>
            </button>
          )}

          {oneOff && (
            <input
              className="input"
              maxLength={200}
              placeholder="למה? למשל: ניתוח לכלבה"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}

          {oneOff && (
            <span className="type-hint">
              השורה נשארת בחודש הזה במלואה. היא רק לא תיחשב כשמחשבים
              כמה חודש רגיל עולה לכם.
            </span>
          )}

          {/* הקיבוץ בעריכה ולא רק בהזנה: מי ששכח ללחוץ עליו בשעת
              ההוצאה מתקן את זה כאן, במקום למחוק ולהזין מחדש.
              בהכנסה אין קיבוץ, בדיוק כמו במגירת ההזנה */}
          {category !== 'income' && (
            <div className="group-field">
              {groups.length > 0 && (
                <div className="group-chips">
                  {groups.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="cat-pill"
                      aria-pressed={group === name}
                      onClick={() => setGroup((current) => (current === name ? '' : name))}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <input
                className="input"
                maxLength={MAX_GROUP_LENGTH}
                placeholder="קיבוץ תחת שם (לא חובה)"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              />

              {/* ההצעה מופיעה רק כשיש קבוצה ויש למי לצרף, כי בלי
                  אחד מהם היא שאלה בלי תשובה */}
              {normalizeGroup(group) && others.length > 0 && (
                <button
                  type="button"
                  className="recur-toggle wrap"
                  aria-pressed={alsoPlace}
                  onClick={() => setAlsoPlace((on) => !on)}
                >
                  {others.length === 1
                    ? 'לצרף גם עוד שורה מאותו מקום'
                    : `לצרף גם עוד ${others.length} שורות מאותו מקום`}
                  <span className="switch"><span className="knob" /></span>
                </button>
              )}

              {normalizeGroup(group) && others.length > 0 && alsoPlace && (
                <span className="type-hint">
                  {others.map((other) => other.name).join(', ')}
                </span>
              )}
            </div>
          )}

          <div className="row-edit-foot">
            <input
              className="input num"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
            />
            <button type="submit" className="mini save" disabled={busy}>שמור</button>
            <button type="button" className="mini cancel" onClick={() => setEditing(false)}>
              ביטול
            </button>
            <button
              type="button"
              className="mini remove"
              onClick={() => onRemove(entry.id, entry)}
              title={entry.recurringId ? 'הסרה מהחודש הזה' : 'מחיקת השורה'}
            >
              מחיקה
            </button>
          </div>

          {entry.recurringId && (
            <span className="type-hint">
              השינוי חל על החודש הזה. בחודש הבא השורה תיווצר שוב מהתבנית.
            </span>
          )}
        </form>
      </li>
    )
  }

  return (
    <li className="entry-row">
      {/* התאריך מתחת לשם ולא לצדו: לצדו הוא מתחרה בשם על הרוחב
          ובשורה צרה אחד מהם נחתך. מתחת הוא הקשר ולא מידע מתחרה */}
      <button
        type="button"
        className={`entry-name as-button${when ? ' stacked' : ''}`}
        onClick={open}
        aria-label={`עריכה של ${entry.name}`}
      >
        <span className="entry-title">{entry.name}</span>
        {when && <span className="row-when num">{when}</span>}
      </button>

      {entry.recurringId && (
        <button
          type="button"
          className="row-tag"
          title="לחיצה מפסיקה את החיוב הקבוע מהחודש הבא"
          onClick={() => onStopRecurring?.(entry)}
        >
          · חודשי
        </button>
      )}

      {entry.oneOff && (
        <span className="row-tag as-tag" title={entry.note || 'לא נחשב כהוצאה רגילה'}>
          · חד פעמי
        </span>
      )}

      {/* שם המזין כטקסט ולא כאווטאר בתוך שורה: אווטאר בגודל שורה
          הוא עיגול צבעוני שמושך את העין אל מי שהזין במקום אל הסכום */}
      {author && (
        <span className="row-author">{displayName(author.member, author.profile)}</span>
      )}

      {/* בלי שם נגיש הכפתור הוכרז כמספר עירום, והיו שני עצירות טאב
          זהות בכל שורה */}
      <button
        type="button"
        className="entry-amount button num"
        aria-label={`עריכת הסכום של ${entry.name}`}
        onClick={open}
      >
        {shekels(entry.actualAmount)}
      </button>
    </li>
  )
}

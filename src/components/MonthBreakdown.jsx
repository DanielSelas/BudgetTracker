import { useMemo } from 'react'
import Sheet from './Sheet'
import { monthLabel, shekels } from '../lib/format'
import { OTHER, headlineSector, monthBreakdown } from '../lib/breakdown'

const SIZE = 180
const RADIUS = 80
const HOLE = 48

/**
 * נקודה על המעגל. מתחיל בשתים עשרה ונע עם כיוון השעון, שזו הקריאה
 * המוסכמת של עוגה בכל שפה, כולל מימין לשמאל.
 */
const point = (fraction, radius) => {
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  return [SIZE / 2 + radius * Math.cos(angle), SIZE / 2 + radius * Math.sin(angle)]
}

const arc = (from, to) => {
  // פלח יחיד הוא טבעת שלמה, ו-arc מנקודה לעצמה אינו מצייר דבר
  if (to - from >= 0.9999) {
    return `M ${SIZE / 2} ${SIZE / 2 - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${SIZE / 2 - 0.01} ${SIZE / 2 - RADIUS}`
      + ` L ${SIZE / 2 - 0.01} ${SIZE / 2 - HOLE} A ${HOLE} ${HOLE} 0 1 0 ${SIZE / 2} ${SIZE / 2 - HOLE} Z`
  }
  const big = to - from > 0.5 ? 1 : 0
  const [ox, oy] = point(from, RADIUS)
  const [ex, ey] = point(to, RADIUS)
  const [ix, iy] = point(to, HOLE)
  const [sx, sy] = point(from, HOLE)
  return `M ${ox} ${oy} A ${RADIUS} ${RADIUS} 0 ${big} 1 ${ex} ${ey}`
    + ` L ${ix} ${iy} A ${HOLE} ${HOLE} 0 ${big} 0 ${sx} ${sy} Z`
}

const shade = (slice, index) => (slice.sector === OTHER
  ? 'var(--color-neutral-300)'
  : `var(--color-neutral-${Math.max(400, 900 - index * 100)})`)

/** הופך את הפלחים לגזרות רצופות, כל אחת ממקום סיומה של קודמתה */
const ring = (slices) => slices.reduce((built, slice, index) => {
  const from = built.length ? built[built.length - 1].to : 0
  const to = from + slice.share
  built.push({ ...slice, to, d: arc(from, to), fill: shade(slice, index) })
  return built
}, [])

/**
 * על מה יצא הכסף בחודש שנבחר.
 *
 * הפלחים צבועים בסולם הנייטרלי מהכהה לבהיר לפי הגודל, ולא בצבע
 * לכל ענף. צבע במערכת הזו שמור לקטגוריה ולאקסנט, ואחד עשר גוונים
 * חדשים היו הופכים את הטבעת לקישוט. הדירוג הוא המידע, והסולם
 * מקודד אותו. בכהה הסולם מתהפך, ולכן הגדול נשאר בעל הניגוד הגבוה.
 *
 * והמספרים נקראים מהרשימה שמתחת ולא מהטבעת: אי אפשר להשוות שטחי
 * גזרה בעין, ולכן לכל שורה יש סכום ואחוז.
 */
export default function MonthBreakdown({ month, entries, baseAmount = 0, onClose }) {
  const { slices, total } = useMemo(() => monthBreakdown(entries), [entries])
  const headline = useMemo(() => headlineSector(entries, baseAmount), [entries, baseAmount])
  const arcs = useMemo(() => ring(slices), [slices])

  const label = `פילוח ההוצאות ב${monthLabel(month)}: ${
    slices.map((slice) => `${slice.sector} ${shekels(slice.amount)}`).join(', ')}`

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form">
        <h2>{monthLabel(month)}</h2>

        {total === 0 ? (
          <p className="empty">
            בחודש הזה אין הוצאות שנבחרו. חיובים קבועים אינם נכללים בפילוח.
          </p>
        ) : (
          <>
            {/* המשפט מרוויח את מקומו ולא מופיע תמיד: ענף נחשב הרבה רק
                כשהוא עבר שליש מיעד ההוצאות המשתנות */}
            {headline && (
              <p className="breakdown-lead">
                יצא לך הכי הרבה על <strong>{headline.sector}</strong>,{' '}
                <strong className="num">{shekels(headline.amount)}</strong>, שהם{' '}
                {Math.round(headline.share * 100)}% מיעד ההוצאות המשתנות.
              </p>
            )}

            <div className="donut">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
                {arcs.map((slice) => (
                  <path key={slice.sector} d={slice.d} fill={slice.fill} />
                ))}
              </svg>
              <div className="donut-mid">
                <span className="cap">סך הכל</span>
                <span className="num">{shekels(total)}</span>
              </div>
            </div>

            <ul className="breakdown-list">
              {arcs.map((slice) => (
                <li key={slice.sector}>
                  <span className="swatch" style={{ background: slice.fill }} aria-hidden="true" />
                  <span className="breakdown-name">{slice.sector}</span>
                  <span className="breakdown-pct num">{Math.round(slice.share * 100)}%</span>
                  <span className="entry-amount num">{shekels(slice.amount)}</span>
                </li>
              ))}
            </ul>

            <p className="hint">
              לפי ענף בית העסק, ובלי חיובים קבועים: שכר דירה וחשבונות אינם
              בחירה שנעשתה החודש. עסק שאינו מזוהה נאסף תחת "{OTHER}".
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}

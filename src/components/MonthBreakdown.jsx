import { useMemo } from 'react'
import Sheet from './Sheet'
import { monthLabel, shekels } from '../lib/format'
import { headlineSector, monthBreakdown, ringSlices, sliceColors } from '../lib/breakdown'

const SIZE = 180
const MID = SIZE / 2
/** רדיוס האמצע של הטבעת, והעובי שסביבו */
const RING = 64
const WIDTH = 32
const CIRC = 2 * Math.PI * RING
/** רווח בין פלחים, במידות ה-viewBox, כדי שגבול יהיה גבול ולא גוון */
const GAP = 3
/** כמה זמן לוקח לסיבוב המלא להתמלא */
const SWEEP = 700

/**
 * הטבעת מצוירת בקווים ולא בגזרות.
 *
 * קו עם stroke-dasharray הוא גזרה שאפשר להאריך, ולכן המילוי הוא
 * אנימציה אחת של אורך הקו במקום צורה שמצוירת מחדש בכל פריים.
 * הפלח מסובב למקומו, ומתחיל בשתים עשרה ונע עם כיוון השעון, שזו
 * הקריאה המוסכמת של עוגה בכל שפה, כולל מימין לשמאל.
 */
const ring = (slices, fills) => slices.reduce((built, slice) => {
  const from = built.length ? built[built.length - 1].to : 0
  const to = from + slice.share
  const full = slice.share * CIRC
  // פלח יחיד הוא טבעת שלמה ואין בה מה להפריד
  const len = slices.length > 1 ? Math.max(full - GAP, Math.min(full, 1)) : full
  built.push({
    ...slice,
    to,
    len,
    turn: from * 360,
    fill: fills.get(slice.sector),
  })
  return built
}, [])

/**
 * על מה יצא הכסף בחודש שנבחר.
 *
 * המספרים נקראים מהרשימה שמתחת ולא מהטבעת: אי אפשר להשוות שטחי
 * גזרה בעין, ולכן לכל שורה יש שם, סכום ואחוז. הצבע מקבץ ענפים
 * קרובים למשפחה אחת, והוא תוספת לזהות ולא הזהות עצמה.
 */
export default function MonthBreakdown({ month, entries, baseAmount = 0, onClose }) {
  const { slices, total } = useMemo(() => monthBreakdown(entries), [entries])
  const headline = useMemo(() => headlineSector(entries, baseAmount), [entries, baseAmount])
  // הטבעת מציירת את הגדולים, והרשימה שמתחת מפרטת את כולם
  const shown = useMemo(() => ringSlices(slices), [slices])
  const fills = useMemo(() => sliceColors([...slices, ...shown]), [slices, shown])
  const arcs = useMemo(() => ring(shown, fills), [shown, fills])

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
                {/* מסילה דהויה מתחת, כדי שבזמן המילוי יהיה מה
                    להתמלא ולא חור בעמוד */}
                <circle
                  cx={MID}
                  cy={MID}
                  r={RING}
                  fill="none"
                  stroke="var(--color-neutral-200)"
                  strokeWidth={WIDTH}
                />

                {/* הטבעת מתמלאת בסיבוב אחד, וכל פלח מתחיל כשקודמו
                    נגמר. המשך של תנועה אחת, לא אחת לכל פלח */}
                {arcs.map((slice) => (
                  <circle
                    key={slice.sector}
                    className="arc"
                    cx={MID}
                    cy={MID}
                    r={RING}
                    fill="none"
                    stroke={slice.fill}
                    strokeWidth={WIDTH}
                    strokeDasharray={`${slice.len} ${CIRC}`}
                    transform={`rotate(${slice.turn - 90} ${MID} ${MID})`}
                    style={{
                      '--len': slice.len,
                      '--delay': `${Math.round((slice.turn / 360) * SWEEP)}ms`,
                      '--dur': `${Math.max(90, Math.round(slice.share * SWEEP))}ms`,
                    }}
                  />
                ))}
              </svg>
              <div className="donut-mid" style={{ '--delay': `${SWEEP - 120}ms` }}>
                <span className="cap">סך הכל</span>
                <span className="num">{shekels(total)}</span>
              </div>
            </div>

            <ul className="breakdown-list">
              {slices.map((slice) => (
                <li key={slice.sector}>
                  <span
                    className="swatch"
                    style={{ background: fills.get(slice.sector) }}
                    aria-hidden="true"
                  />
                  <span className="breakdown-name">{slice.sector}</span>
                  <span className="breakdown-pct num">{Math.round(slice.share * 100)}%</span>
                  <span className="entry-amount num">{shekels(slice.amount)}</span>
                </li>
              ))}
            </ul>

            <p className="hint">
              הוצאות משתנות ובלת״ם בלבד. קבועות אינן כאן: שכר דירה, חשבונות
              וביטוח אינם בחירה שנעשתה החודש.{' '}
              {arcs.length < slices.length
                ? 'הטבעת מראה את הגדולים, והרשימה את כולם.'
                : ''}
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}

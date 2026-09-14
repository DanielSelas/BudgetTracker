import { useState } from 'react'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, calcBaseAmount } from '../lib/model'
import { GOAL_PILLS, TRIP_PILLS } from '../lib/pills'

// המפתח של משק הבית נשאר כפי שהיה, כדי שמי שכבר ראה לא יראה שוב
const KEYS = {
  household: 'budgettracker:seen-intro',
  trip: 'budgettracker:seen-intro-trip',
  goal: 'budgettracker:seen-intro-goal',
}

export function seenIntro(kind = 'household') {
  try {
    return localStorage.getItem(KEYS[kind]) === '1'
  } catch {
    // מצב פרטי בדפדפן. עדיף להראות פעמיים מאשר להתרסק
    return true
  }
}

export function markIntroSeen(kind = 'household') {
  try {
    localStorage.setItem(KEYS[kind], '1')
  } catch {
    // אין מה לעשות, ההסבר פשוט יופיע שוב בביקור הבא
  }
}

/**
 * לכל סוג תקציב דוגמה אחת שרצה לאורך כל השלבים. מספר אחד שממשיך
 * משלב לשלב מסביר את המודל הרבה יותר טוב מארבעה מסכים נפרדים.
 */
const INCOME = 24600
const BASE = calcBaseAmount(INCOME)
const RESERVE = INCOME - BASE

const TRIP_FRAME = 12000
const TRIP_SPENT = 7340

const GOAL_TARGET = 40000
const GOAL_SAVED = 16000

const GROUPS = [
  { group: 'fixed', category: 'fixed', label: 'קבועות', hint: 'שכר דירה, חשבונות, ביטוח' },
  { group: 'leisure', category: 'leisure', label: 'פנאי', hint: 'מסעדות, בילויים, קניות' },
  { group: 'savings', category: 'fund', label: 'קרן', hint: 'חיסכון, ומה שנשמר לימים אחרים' },
]

function Bars() {
  return (
    <div className="intro-bars">
      {GROUPS.map(({ group, category, label, hint }) => (
        <div className="intro-bar" key={group} data-category={category}>
          <div className="intro-bar-head">
            <span className="intro-bar-label">
              <span className="dot" />
              {label}
            </span>
            <span className="num">{shekels(BASE * BUDGET_GROUP_RATIOS[group])}</span>
          </div>
          <div className="intro-track">
            <div className="intro-fill" style={{ width: `${BUDGET_GROUP_RATIOS[group] * 100}%` }} />
          </div>
          <span className="intro-bar-hint">{hint}</span>
        </div>
      ))}
    </div>
  )
}

function Pills({ items, category }) {
  return (
    <div className="intro-pills" data-category={category}>
      {items.map((item) => (
        <span className="intro-chip" key={item.category}>{item.label}</span>
      ))}
    </div>
  )
}

/** כמה שורות שמתכנסות לשורה אחת, התמונה של הזקיפה לתקציב הבית. */
function Rollup({ lines, into, category }) {
  return (
    <div className="intro-rollup">
      <div className="intro-rollup-lines">
        {lines.map((line) => <span className="intro-chip" key={line}>{line}</span>)}
      </div>
      <span className="intro-arrow">↓</span>
      <span className="intro-chip big" data-category={category}>{into}</span>
    </div>
  )
}

const HOUSEHOLD = [
  {
    title: 'תמונה אחת, לשניכם',
    body: 'כל מה ששניכם מזינים מופיע מיד אצל השני. בלי צילומי מסך ובלי לשאול כל הזמן כמה נשאר.',
    art: (
      <div className="intro-pair" aria-hidden="true">
        <span className="intro-face" data-category="income">ד</span>
        <span className="intro-face" data-category="leisure">נ</span>
      </div>
    ),
  },
  {
    title: 'הכל מתחיל מהכנסה',
    body: `נכנסו ${shekels(INCOME)} החודש. מהם נגזר סכום בסיס עגול של ${shekels(BASE)}, וזה הסכום שמחלקים.`,
    art: (
      <div className="intro-flow" aria-hidden="true">
        <span className="intro-chip big num" data-category="income">{shekels(INCOME)}</span>
        <span className="intro-arrow">↓</span>
        <span className="intro-chip big num">{shekels(BASE)}</span>
      </div>
    ),
  },
  {
    title: 'חמישים, שלושים, עשרים',
    body: `סכום הבסיס מתחלק לשלושה יעדים, וככה נראים ${shekels(BASE)} בפועל`,
    art: <Bars />,
  },
  {
    title: 'ומה שנשאר הוא הבלת״ם',
    body: `ההפרש בין ההכנסה לסכום הבסיס, ${shekels(RESERVE)}, נשמר בצד לדברים שלא מתוכננים. תקר, מתנה, רופא שיניים.`,
    art: (
      <div className="intro-reserve" aria-hidden="true" data-category="unplanned">
        <div className="intro-track tall">
          <div className="intro-fill base" style={{ width: `${(BASE / INCOME) * 100}%` }} />
        </div>
        <span className="intro-reserve-tag num">{shekels(RESERVE)}</span>
      </div>
    ),
  },
]

const TRIP = [
  {
    title: 'מסגרת אחת לכל הטיול',
    body: `החלטתם מראש ${shekels(TRIP_FRAME)}. כל הוצאה שתזינו מכרסמת בהם, וברור בכל רגע כמה נשאר.`,
    art: (
      <div className="intro-reserve" aria-hidden="true" data-category="leisure">
        <div className="intro-track tall">
          <div className="intro-fill" style={{ width: `${(TRIP_SPENT / TRIP_FRAME) * 100}%` }} />
        </div>
        <span className="intro-reserve-tag num">
          נשאר {shekels(TRIP_FRAME - TRIP_SPENT)}
        </span>
      </div>
    ),
  },
  {
    title: 'קטגוריות של טיול',
    body: 'לא קבועות ופנאי. בטיול מעניין משהו אחר לגמרי, ולכן יש לו קטגוריות משלו.',
    art: <Pills items={TRIP_PILLS} category="leisure" />,
  },
  {
    title: 'לכל הוצאה יש תאריך',
    body: 'טיול שחוצה חודשים מתפצל לבד לפי התאריכים, ולא נזקף כולו לחודש שבו יצאתם.',
    art: (
      <div className="intro-flow" aria-hidden="true">
        <span className="intro-chip">אוגוסט</span>
        <span className="intro-chip">ספטמבר</span>
      </div>
    ),
  },
  {
    title: 'ומתחבר לתקציב הבית',
    body: 'אם קישרתם לתקציב בית, כל הפירוט נשאר כאן והבית מקבל שורה מסכמת אחת לכל חודש, בבלת״ם.',
    art: (
      <Rollup
        category="unplanned"
        lines={['מלון', 'טיסות', 'מסעדות']}
        into="טיול: יוון"
      />
    ),
  },
]

const GOAL = [
  {
    title: 'יעד אחד, ואתם מטפסים אליו',
    body: `רוצים ${shekels(GOAL_TARGET)}. הפס כאן מתמלא במקום להתרוקן, כי כאן צבירה היא ההישג.`,
    art: (
      <div className="intro-reserve" aria-hidden="true" data-category="fund">
        <div className="intro-track tall">
          <div className="intro-fill" style={{ width: `${(GOAL_SAVED / GOAL_TARGET) * 100}%` }} />
        </div>
        <span className="intro-reserve-tag num">
          נחסכו {shekels(GOAL_SAVED)}
        </span>
      </div>
    ),
  },
  {
    title: 'הפקדות, וגם משיכות',
    body: 'הפקדה מגדילה את הצבירה ומשיכה מקטינה אותה, כי חיסכון אמיתי הוא לא רק כיוון אחד.',
    art: <Pills items={GOAL_PILLS} category="fund" />,
  },
  {
    title: 'תמיד רואים כמה נשאר',
    body: `נחסכו ${shekels(GOAL_SAVED)} מתוך ${shekels(GOAL_TARGET)}, אז נשאר לחסוך ${shekels(GOAL_TARGET - GOAL_SAVED)}.`,
    art: (
      <div className="intro-flow" aria-hidden="true">
        <span className="intro-chip big num" data-category="fund">{shekels(GOAL_SAVED)}</span>
        <span className="intro-arrow">↓</span>
        <span className="intro-chip big num">{shekels(GOAL_TARGET - GOAL_SAVED)}</span>
      </div>
    ),
  },
  {
    title: 'ומתחבר לקרן',
    body: 'אם קישרתם לתקציב בית, ההפקדות מופיעות שם בקרן כשורה אחת לכל חודש. משיכה מקטינה אותה.',
    art: (
      <Rollup
        category="fund"
        lines={['הפקדה', 'הפקדה', 'משיכה']}
        into="חיסכון: רכב חדש"
      />
    ),
  },
]

const BY_KIND = { household: HOUSEHOLD, trip: TRIP, goal: GOAL }

/** הסבר קצר שמופיע פעם אחת לכל סוג תקציב, בכניסה הראשונה אליו. */
export default function Welcome({ kind = 'household', onClose }) {
  const [step, setStep] = useState(0)
  const steps = BY_KIND[kind] || HOUSEHOLD
  const last = step === steps.length - 1
  const current = steps[step]

  function finish() {
    markIntroSeen(kind)
    onClose()
  }

  return (
    <Sheet onClose={finish}>
      <div className="intro">
        <div className="intro-art">{current.art}</div>

        <h2>{current.title}</h2>
        <p className="intro-body">{current.body}</p>

        <div className="intro-dots" role="presentation">
          {steps.map((item, index) => (
            <span key={item.title} className="intro-dot" data-on={index === step || undefined} />
          ))}
        </div>

        <div className="sheet-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => (last ? finish() : setStep((n) => n + 1))}
          >
            {last ? 'מתחילים' : 'הבא'}
          </button>
          {!last && (
            <button type="button" className="btn-secondary" onClick={finish}>
              דילוג
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

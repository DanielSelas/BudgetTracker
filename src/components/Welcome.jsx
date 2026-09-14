import { useState } from 'react'
import Sheet from './Sheet'
import { shekels } from '../lib/format'
import { BUDGET_GROUP_RATIOS, calcBaseAmount } from '../lib/model'

const KEY = 'budgettracker:seen-intro'

export function seenIntro() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // מצב פרטי בדפדפן. עדיף להראות פעמיים מאשר להתרסק
    return true
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // אין מה לעשות, ההסבר פשוט יופיע שוב בביקור הבא
  }
}

/**
 * דוגמה אחת שרצה לאורך כל ההסבר. מספר אחד שממשיך משלב לשלב מסביר
 * את המודל הרבה יותר טוב מארבעה מסכים שכל אחד מדבר על משהו אחר.
 */
const INCOME = 24600
const BASE = calcBaseAmount(INCOME)
const RESERVE = INCOME - BASE

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
            <div
              className="intro-fill"
              style={{ width: `${BUDGET_GROUP_RATIOS[group] * 100}%` }}
            />
          </div>
          <span className="intro-bar-hint">{hint}</span>
        </div>
      ))}
    </div>
  )
}

const STEPS = [
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

/** הסבר קצר שמופיע פעם אחת, בכניסה הראשונה לתקציב משק בית. */
export default function Welcome({ onClose }) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const current = STEPS[step]

  function finish() {
    markIntroSeen()
    onClose()
  }

  return (
    <Sheet onClose={finish}>
      <div className="intro">
        <div className="intro-art">{current.art}</div>

        <h2>{current.title}</h2>
        <p className="intro-body">{current.body}</p>

        <div className="intro-dots" role="presentation">
          {STEPS.map((item, index) => (
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

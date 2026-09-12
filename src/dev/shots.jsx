import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import CategoryCard from '../components/CategoryCard'
import SummaryCard from '../components/SummaryCard'
import UnplannedCard from '../components/UnplannedCard'
import MonthPicker from '../components/MonthPicker'
import EntrySheet from '../components/EntrySheet'
import { summarizeMonth, CATEGORIES } from '../lib/model'
import '../index.css'
import '../App.css'

const m1 = { uid: 'u1', displayName: 'דניאל', role: 'owner' }
const m2 = { uid: 'u2', displayName: 'נועה', role: 'member' }
const idx = new Map([[m1.uid, { member: m1, index: 0 }], [m2.uid, { member: m2, index: 1 }]])
const authorOf = (uid) => idx.get(uid) ?? null

const entries = [
  { id: '1', category: 'income', budgetGroup: 'none', name: 'משכורת דניאל', plannedAmount: 14200, actualAmount: 14200, addedBy: 'u1', recurringId: 'r1' },
  { id: '2', category: 'income', budgetGroup: 'none', name: 'משכורת נועה', plannedAmount: 10400, actualAmount: 10400, addedBy: 'u2', recurringId: 'r5' },
  { id: '3', category: 'fixed', budgetGroup: 'fixed', name: 'שכר דירה', plannedAmount: 5200, actualAmount: 5200, addedBy: 'u1', recurringId: 'r2' },
  { id: '4', category: 'fixed', budgetGroup: 'fixed', name: 'קניות סופר', plannedAmount: 2000, actualAmount: 2100, addedBy: 'u2' },
  { id: '5', category: 'fixed', budgetGroup: 'fixed', name: 'חשמל, מים, אינטרנט', plannedAmount: 850, actualAmount: 850, addedBy: 'u1', recurringId: 'r6' },
  { id: '6', category: 'leisure', budgetGroup: 'leisure', name: 'מסעדות ובילויים', plannedAmount: 1500, actualAmount: 1860, addedBy: 'u2' },
  { id: '7', category: 'leisure', budgetGroup: 'leisure', name: 'קפה בחוץ', plannedAmount: 400, actualAmount: 420, addedBy: 'u1' },
  { id: '8', category: 'leisure', budgetGroup: 'leisure', name: 'בגדים', plannedAmount: 1000, actualAmount: 1380, addedBy: 'u2' },
  { id: '9', category: 'fund', budgetGroup: 'savings', name: 'קרן השתלמות', plannedAmount: 4000, actualAmount: 4000, addedBy: 'u1' },
  { id: '10', category: 'fund', budgetGroup: 'savings', name: 'עודף מבלתם', plannedAmount: 0, actualAmount: 500, addedBy: 'u2' },
]
const summary = summarizeMonth(entries)
const byCategory = { income: [], fixed: [], leisure: [], fund: [] }
entries.forEach((e) => byCategory[e.category].push(e))
const actions = { add: async () => {}, update: async () => {}, remove: () => {} }
const noop = () => {}

function Month({ from = 0 }) {
  const order = ['income', 'fixed', 'leisure', 'fund'].slice(from)
  return (
    <main className="app">
      {from === 0 && (
        <div className="sticky-head">
          <MonthPicker month="2026-09" onChange={noop} subtitle="משק הבית · משותף" />
        </div>
      )}
      <div className="app-scroll">
        {from === 0 && <><SummaryCard summary={summary} /><UnplannedCard summary={summary} /></>}
        {order.map((category) => (
          <CategoryCard key={category} category={category} entries={byCategory[category]}
            group={summary.groups[CATEGORIES[category].budgetGroup]} authorOf={authorOf}
            actions={actions} onAdd={noop} onStopRecurring={noop} />
        ))}
      </div>
      <button type="button" className="fab"><span className="plus">+</span> הוצאה</button>
      <BottomNav active="month" onChange={noop} />
    </main>
  )
}

function Home() {
  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head">
          <div><h1>התקציבים שלי</h1><p className="muted">daniel@mail.com</p></div>
          <button type="button" className="btn-round">↪</button>
        </header>
        <ul className="budget-list">
          <li><button type="button" className="budget-card shared">
            <span className="budget-card-top">
              <span className="budget-name">משק הבית</span>
              <span className="tag shared">משותף · 2</span>
            </span>
            <span className="member-row">
              <Avatar member={m1} index={0} /><Avatar member={m2} index={1} stacked />
              <span className="names">דניאל ונועה · נוצר על ידך</span>
            </span>
            <span className="budget-remaining">נשאר החודש <strong className="num">7,420 ₪</strong></span>
          </button></li>
          <li><button type="button" className="budget-card">
            <span className="budget-card-top">
              <span className="budget-name">התקציב שלי</span>
              <span className="tag">אישי</span>
            </span>
            <span className="member-row">
              <Avatar member={m1} index={0} /><span className="names">רק אתה רואה אותו</span>
            </span>
            <span className="budget-remaining">נשאר החודש <strong className="num">1,180 ₪</strong></span>
          </button></li>
        </ul>
        <button type="button" className="dashed-card">+ תקציב חדש או הצטרפות עם קוד</button>
        <section className="invite-panel">
          <h2>להזמין את בן/בת הזוג</h2>
          <p className="sub">קוד חד פעמי לשבוע, נשלח בוואטסאפ.</p>
          <span className="invite-code">K7M2QX4B</span>
          <div className="invite-actions">
            <button type="button" className="chip-button">העתקת הקוד</button>
            <button type="button" className="chip-button">קוד אחר</button>
          </div>
        </section>
      </div>
      <BottomNav active="budgets" onChange={noop} />
    </main>
  )
}

function Sheet() {
  return (
    <>
      <Month />
      <EntrySheet initialCategory="fixed" summary={summary}
        me={{ member: m1, index: 0 }} partner="נועה" onSubmit={async () => {}} onClose={noop} />
    </>
  )
}

function History() {
  const GROUPS = [
    { label: 'קבועות', category: 'fixed', target: 50, percent: 47 },
    { label: 'פנאי', category: 'leisure', target: 30, percent: 34 },
    { label: 'קרן', category: 'fund', target: 20, percent: 19 },
  ]
  const data = [['אפר׳',96,64,40],['מאי',112,78,30],['יוני',88,52,46],['יולי',104,88,26],['אוג׳',92,58,52],['ספט׳',82,44,56]]
  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head">
          <div><h2>שישה חודשים אחורה</h2><p className="muted">איך עמדתם ביחס 50/30/20 בפועל.</p></div>
        </header>
        <section className="chart-card">
          <div className="legend">{GROUPS.map((g) => (
            <span key={g.label}><span className="swatch" style={{ background: `var(--cat-${g.category}-base)` }} />{g.label}</span>
          ))}</div>
          <div className="bars">{data.map(([m,a,b,c],i) => (
            <div key={m} className={`bars-col ${i===5?'current':''}`}>
              <div className="bars-group">
                <i style={{ height: a, background: 'var(--cat-fixed-base)' }} />
                <i style={{ height: b, background: 'var(--cat-leisure-base)' }} />
                <i style={{ height: c, background: 'var(--cat-fund-base)' }} />
              </div>
              <span className="m">{m}</span>
            </div>
          ))}</div>
        </section>
        <div className="avg-list">{GROUPS.map((g) => (
          <div key={g.label} className="avg-card" data-category={g.category}>
            <span className="name">{g.label} בממוצע</span>
            <span className="val"><strong className="num">{g.percent}%</strong><span className="num">יעד {g.target}%</span></span>
          </div>
        ))}</div>
      </div>
      <BottomNav active="history" onChange={noop} />
    </main>
  )
}

function LoginShot() {
  return (
    <main className="app login">
      <div className="login-blob one" /><div className="login-blob two" />
      <div className="login-inner">
        <div className="login-mark">ב</div>
        <h1>בית ותקציב</h1>
        <p className="muted">שניכם, אותו חודש, אותה תמונה.</p>
      </div>
      <form className="login-form">
        <label className="field">אימייל<input className="input ltr" defaultValue="daniel@mail.com" /></label>
        <label className="field">סיסמה<input className="input ltr" type="password" defaultValue="12345678" /></label>
        <button type="button" className="btn-primary">כניסה</button>
        <button type="button" className="btn-secondary">כניסה עם Google</button>
        <p className="hint center">הצטרפות לתקציב קיים? יש לכם קוד הזמנה.</p>
      </form>
    </main>
  )
}

const SCREENS = { month: <Month />, cats: <Month from={1} />, home: <Home />, sheet: <Sheet />, history: <History />, login: <LoginShot /> }
const which = new URLSearchParams(location.search).get('s') || 'month'
createRoot(document.getElementById('root')).render(<StrictMode>{SCREENS[which]}</StrictMode>)

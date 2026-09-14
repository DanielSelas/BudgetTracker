import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Avatar from '../components/Avatar'
import Welcome from '../components/Welcome'
import BottomNav from '../components/BottomNav'
import CategoryCard from '../components/CategoryCard'
import UnplannedCard from '../components/UnplannedCard'
import SummaryCard from '../components/SummaryCard'
import MonthPicker from '../components/MonthPicker'
import EntrySheet from '../components/EntrySheet'
import EntryRow from '../components/EntryRow'
import { shekels } from '../lib/format'
import {
  BUDGET_TYPES, CATEGORIES, GOAL_CATEGORIES, GOAL_ORDER,
  TRIP_CATEGORIES, TRIP_ORDER,
  summarizeMonth, summarizeTrip, summarizeGoal,
} from '../lib/model'
import '../index.css'
import '../App.css'

const m1 = { uid: 'u1', displayName: 'דניאל', role: 'owner' }
const m2 = { uid: 'u2', displayName: 'נועה', role: 'member' }
const idx = new Map([['u1', { member: m1, index: 0 }], ['u2', { member: m2, index: 1 }]])
const authorOf = (uid) => idx.get(uid) ?? null
const noop = () => {}
const actions = { add: async () => {}, update: async () => {}, remove: () => {} }

const entries = [
  { id: '1', category: 'income', budgetGroup: 'none', name: 'משכורת דניאל', plannedAmount: 14200, actualAmount: 14200, addedBy: 'u1', recurringId: 'r1' },
  { id: '2', category: 'income', budgetGroup: 'none', name: 'משכורת נועה', plannedAmount: 10400, actualAmount: 10400, addedBy: 'u2', recurringId: 'r5' },
  { id: '3', category: 'fixed', budgetGroup: 'fixed', name: 'שכר דירה', plannedAmount: 5200, actualAmount: 5200, addedBy: 'u1', recurringId: 'r2' },
  { id: '4', category: 'fixed', budgetGroup: 'fixed', name: 'קנייה גדולה', plannedAmount: 0, actualAmount: 1240, addedBy: 'u2', groupKey: 'קניות בסופר' },
  { id: '4b', category: 'fixed', budgetGroup: 'fixed', name: 'חלב ולחם', plannedAmount: 0, actualAmount: 38, addedBy: 'u1', groupKey: 'קניות בסופר' },
  { id: '4c', category: 'fixed', budgetGroup: 'fixed', name: 'השלמות לשבת', plannedAmount: 0, actualAmount: 822, addedBy: 'u2', groupKey: 'קניות בסופר' },
  { id: '5', category: 'fixed', budgetGroup: 'fixed', name: 'חשמל, מים, אינטרנט', plannedAmount: 850, actualAmount: 850, addedBy: 'u1', recurringId: 'r6' },
  { id: '6', category: 'leisure', budgetGroup: 'leisure', name: 'מסעדות ובילויים', plannedAmount: 1500, actualAmount: 1860, addedBy: 'u2' },
  { id: '7', category: 'leisure', budgetGroup: 'leisure', name: 'קפה בחוץ', plannedAmount: 400, actualAmount: 420, addedBy: 'u1' },
  { id: '9', category: 'fund', budgetGroup: 'savings', name: 'קרן השתלמות', plannedAmount: 4000, actualAmount: 4000, addedBy: 'u1' },
  { id: '11', category: 'unplanned', budgetGroup: 'none', name: 'תיקון רכב', plannedAmount: 0, actualAmount: 1800, addedBy: 'u1' },
  { id: '12', category: 'unplanned', budgetGroup: 'none', name: 'טיול: איטליה', plannedAmount: 0, actualAmount: 1200, addedBy: 'u1', linkedTripId: 't1' },
]
const summary = summarizeMonth(entries)
const byCategory = { income: [], fixed: [], leisure: [], fund: [], unplanned: [] }
entries.forEach((e) => byCategory[e.category].push(e))
const ORDER = ['income', 'fixed', 'leisure', 'fund']

const tripEntries = [
  { id: 'a', category: 'lodging', name: 'מלון באתונה', actualAmount: 3200, addedBy: 'u1', date: '2026-08-02' },
  { id: 'b', category: 'lodging', name: 'צימר בסנטוריני', actualAmount: 2400, addedBy: 'u2', date: '2026-08-05' },
  { id: 'c', category: 'transport', name: 'טיסות', actualAmount: 2800, addedBy: 'u1', date: '2026-07-30' },
  { id: 'd', category: 'attractions', name: 'אקרופוליס', actualAmount: 260, addedBy: 'u1', date: '2026-08-03' },
  { id: 'e', category: 'dining', name: 'מסעדות', actualAmount: 1450, addedBy: 'u2', date: '2026-08-04' },
  { id: 'f', category: 'shopping', name: 'מזכרות', actualAmount: 380, addedBy: 'u1', date: '2026-08-06' },
]
const trip = summarizeTrip(tripEntries, 12000)

function Month() {
  return (
    <main className="app">
      <div className="sticky-head">
        <MonthPicker month="2026-09" onChange={noop} subtitle="משק הבית · משותף" billingDay={10} />
      </div>
      <div className="app-scroll">
        <SummaryCard summary={summary} />
        {ORDER.map((category) => (
          <CategoryCard key={category} category={category} entries={byCategory[category]}
            group={summary.groups[CATEGORIES[category].budgetGroup]} authorOf={authorOf}
            actions={actions} onAdd={noop} onStopRecurring={noop} />
        ))}
        <UnplannedCard summary={summary} entries={byCategory.unplanned}
          authorOf={authorOf} actions={actions} onAdd={noop} onStopRecurring={noop} />
      </div>
      <button type="button" className="fab"><span className="plus">+</span> הוצאה</button>
      <BottomNav active="month" onChange={noop} />
    </main>
  )
}

function Reserve() {
  return (
    <main className="app">
      <div className="app-scroll">
        <UnplannedCard summary={summary} entries={byCategory.unplanned}
          authorOf={authorOf} actions={actions} onAdd={noop} onStopRecurring={noop} />
        <CategoryCard category="fund" entries={byCategory.fund}
          group={summary.groups.savings} authorOf={authorOf}
          actions={actions} onAdd={noop} onStopRecurring={noop} />
      </div>
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
              <span className="tag-row">
                <span className="tag quiet">משק בית</span>
                <span className="tag shared">משותף · 2</span>
              </span>
            </span>
            <span className="member-row">
              <Avatar member={m1} index={0} /><Avatar member={m2} index={1} stacked />
              <span className="names">דניאל ונועה · נוצר על ידך</span>
            </span>
            <span className="budget-remaining">נשאר החודש <strong className="num">{shekels(summary.balance)}</strong></span>
          </button></li>
          <li><button type="button" className="budget-card">
            <span className="budget-card-top">
              <span className="budget-name">יוון באוגוסט</span>
              <span className="tag-row">
                <span className="tag quiet">טיול</span>
                <span className="tag">אישי</span>
              </span>
            </span>
            <span className="member-row">
              <Avatar member={m1} index={0} /><span className="names">רק אתה רואה אותו</span>
            </span>
            <span className="budget-remaining">נשאר מהמסגרת <strong className="num">{shekels(trip.remaining)}</strong></span>
          </button></li>
        </ul>
        <button type="button" className="dashed-card">+ תקציב חדש או הצטרפות עם קוד</button>
        <section className="invite-panel">
          <h2>להזמין את בן/בת הזוג</h2>
          <p className="sub">קוד חד פעמי לשבוע, נשלח בוואטסאפ.</p>
          <span className="invite-code">K7M2QX4B</span>
        </section>
      </div>
      <BottomNav active="budgets" onChange={noop} />
    </main>
  )
}

function Types() {
  return (
    <main className="app">
      <div className="app-scroll">
        <header className="screen-head"><div><h1>תקציב חדש</h1></div></header>
        <form className="sheet sheet-static">
          <div className="cat-pills">
            <button type="button" className="cat-pill" data-category="fixed" aria-pressed="true">תקציב חדש</button>
            <button type="button" className="cat-pill" data-category="income">הצטרפות עם קוד</button>
          </div>
          <div className="type-choice">
            {Object.entries(BUDGET_TYPES).map(([key, meta], i) => (
              <button key={key} type="button" className="type-option" aria-pressed={i === 1}>
                <span className="type-label">{meta.label}</span>
                <span className="type-hint">{meta.hint}</span>
              </button>
            ))}
          </div>
          <label className="field">שם התקציב
            <input className="input" defaultValue="יוון באוגוסט" />
          </label>
          <label className="field">מסגרת לטיול
            <input className="input num" defaultValue="12000" />
          </label>
          <label className="field">לחייב את הבלתם של
            <select className="input rtl" defaultValue="b1">
              <option value="b1">משק הבית</option>
            </select>
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn-primary">יצירה</button>
            <button type="button" className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </main>
  )
}

function Trip() {
  return (
    <main className="app">
      <div className="sticky-head">
        <header className="trip-head"><h1>יוון באוגוסט</h1><p className="muted">משותף · 2</p></header>
      </div>
      <div className="app-scroll">
        <section className="summary">
          <div className="summary-hero">
            <span className="cap">נשאר מהמסגרת</span>
            <span className="amount num">{shekels(trip.remaining)}</span>
          </div>
          <div className="summary-tiles">
            <div><span className="cap">מסגרת</span><span className="val num">{shekels(trip.frame)}</span></div>
            <div><span className="cap">הוצא</span><span className="val num">{shekels(trip.spent)}</span></div>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: `${trip.progress}%` }} /></div>
        </section>
        <p className="hint center">ההוצאות כאן מופיעות גם בבלתם של תקציב הבית, כשורה אחת לכל חודש. מסונכרן ✓</p>
        {TRIP_ORDER.map((category) => (
          <section className="cat-card" data-category={category} key={category}>
            <div className="cat-head">
              <span className="cat-title"><span className="dot" /><h2>{TRIP_CATEGORIES[category].label}</h2></span>
              <span className="cat-total num">{shekels(trip.totals[category])}</span>
            </div>
            {trip.byCategory[category].length > 0 ? (
              <ul className="entry-list">
                {trip.byCategory[category].map((e) => (
                  <EntryRow key={e.id} entry={e} author={authorOf(e.addedBy)}
                    onUpdate={actions.update} onRemove={actions.remove} />
                ))}
              </ul>
            ) : <p className="empty">אין עדיין שורות</p>}
            <button type="button" className="btn-text">+ הוספה</button>
          </section>
        ))}
      </div>
      <button type="button" className="fab"><span className="plus">+</span> הוצאה</button>
      <BottomNav active="month" onChange={noop} type="trip" />
    </main>
  )
}

function SheetShot() {
  return (
    <>
      <Month />
      <EntrySheet initialCategory="fixed" summary={summary}
        me={{ member: m1, index: 0 }} partner="נועה" onSubmit={async () => {}} onClose={noop} />
    </>
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
        <div className="cat-pills">
          <button type="button" className="cat-pill" data-category="fixed" aria-pressed="true">כניסה</button>
          <button type="button" className="cat-pill" data-category="income">הרשמה</button>
        </div>
        <label className="field">אימייל<input className="input ltr" defaultValue="daniel@mail.com" /></label>
        <label className="field">סיסמה<input className="input ltr" type="password" defaultValue="12345678" /></label>
        <button type="button" className="btn-primary">כניסה</button>
        <button type="button" className="btn-secondary">המשך עם Google</button>
        <p className="hint center">אין לכם עדיין חשבון? עברו להרשמה.</p>
      </form>
    </main>
  )
}

const goalEntries = [
  { id: 'g1', category: 'deposit', name: 'הפקדה חודשית', actualAmount: 2500, addedBy: 'u1', date: '2026-07-01' },
  { id: 'g2', category: 'deposit', name: 'בונוס', actualAmount: 4000, addedBy: 'u2', date: '2026-08-01' },
  { id: 'g3', category: 'deposit', name: 'הפקדה חודשית', actualAmount: 2500, addedBy: 'u1', date: '2026-09-01' },
  { id: 'g4', category: 'withdrawal', name: 'תיקון דחוף', actualAmount: 1200, addedBy: 'u2', date: '2026-08-20' },
]
const goal = summarizeGoal(goalEntries, 40000)

function Goal() {
  return (
    <main className="app">
      <div className="sticky-head">
        <header className="trip-head"><h1>רכב חדש</h1><p className="muted">משותף · 2</p></header>
      </div>
      <div className="app-scroll">
        <section className="summary">
          <div className="summary-hero">
            <span className="cap">נחסך עד היום</span>
            <span className="amount num">{shekels(goal.saved)}</span>
          </div>
          <div className="summary-tiles">
            <div><span className="cap">יעד</span><span className="val num">{shekels(goal.target)}</span></div>
            <div><span className="cap">נשאר לחסוך</span><span className="val num">{shekels(goal.remaining)}</span></div>
          </div>
          <div className="bar"><div className="bar-fill goal" style={{ width: `${goal.progress}%` }} /></div>
        </section>
        <p className="hint center">ההפקדות כאן מופיעות גם בקרן של תקציב הבית, כשורה אחת לכל חודש. מסונכרן ✓</p>
        {GOAL_ORDER.map((category) => (
          <section className="cat-card" data-category={category} key={category}>
            <div className="cat-head">
              <span className="cat-title"><span className="dot" /><h2>{GOAL_CATEGORIES[category].label}</h2></span>
              <span className="cat-total num">{shekels(goal.totals[category])}</span>
            </div>
            {goal.byCategory[category].length > 0 ? (
              <ul className="entry-list">
                {goal.byCategory[category].map((e) => (
                  <EntryRow key={e.id} entry={e} author={authorOf(e.addedBy)}
                    onUpdate={actions.update} onRemove={actions.remove} />
                ))}
              </ul>
            ) : <p className="empty">אין עדיין שורות</p>}
            <button type="button" className="btn-text">+ הוספה</button>
          </section>
        ))}
      </div>
      <button type="button" className="fab"><span className="plus">+</span> הפקדה</button>
      <BottomNav active="month" onChange={noop} type="goal" />
    </main>
  )
}

const SCREENS = {
  month: <Month />, reserve: <Reserve />, home: <Home />,
  types: <Types />, trip: <Trip />, goal: <Goal />, sheet: <SheetShot />, login: <LoginShot />,
  // ההסבר מוצג מעל מסך החודש, כי זה ההקשר שבו הוא מופיע באמת
  intro: <><Month /><Welcome onClose={noop} /></>,
}
const which = new URLSearchParams(location.search).get('s') || 'month'
createRoot(document.getElementById('root')).render(<StrictMode>{SCREENS[which]}</StrictMode>)

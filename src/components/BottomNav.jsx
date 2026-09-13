const ALL_TABS = {
  month: { id: 'month', label: 'החודש' },
  trip: { id: 'month', label: 'הטיול' },
  history: { id: 'history', label: 'היסטוריה' },
  budgets: { id: 'budgets', label: 'תקציבים' },
}

// בטיול אין מגמה בין חודשים, ולכן אין מה להציג בלשונית היסטוריה
const TAB_SETS = {
  household: ['month', 'history', 'budgets'],
  trip: ['trip', 'budgets'],
}

export default function BottomNav({ active, onChange, type = 'household' }) {
  const tabs = TAB_SETS[type].map((key) => ALL_TABS[key])

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

const TABS = [
  { id: 'month', label: 'החודש' },
  { id: 'history', label: 'היסטוריה' },
  { id: 'budgets', label: 'תקציבים' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
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

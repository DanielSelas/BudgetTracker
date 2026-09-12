import { GroupTargetChart, IncomeExpenseChart } from './HistoryChart'

const GROUPS = [
  { group: 'fixed', label: 'קבועות · יעד 50%', color: 'var(--series-1)' },
  { group: 'leisure', label: 'פנאי · יעד 30%', color: 'var(--series-2)' },
  { group: 'savings', label: 'חיסכון · יעד 20%', color: 'var(--series-3)', exceedIsGood: true },
]

export default function HistoryCharts({ series }) {
  return (
    <div className="charts">
      <figure>
        <figcaption>הכנסות מול הוצאות</figcaption>
        <IncomeExpenseChart series={series} />
      </figure>

      {/* גרף נפרד לכל קבוצה: לכל אחת יעד אחר, ולכן רק אחוז העמידה ביעד ניתן להשוואה */}
      {GROUPS.map((item) => (
        <figure key={item.group}>
          <figcaption>
            {item.label}
            <span className="hint"> (100% הוא היעד)</span>
          </figcaption>
          <GroupTargetChart
            series={series}
            group={item.group}
            color={item.color}
            exceedIsGood={item.exceedIsGood}
          />
        </figure>
      ))}
    </div>
  )
}

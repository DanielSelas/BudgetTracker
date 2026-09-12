import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { monthLabel, shekels } from '../lib/format'

const SHORT_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const shortMonth = (key) => SHORT_MONTHS[Number(key.split('-')[1]) - 1]
const compact = (value) => (value >= 1000 ? `${Math.round(value / 1000)}K` : String(value))

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{monthLabel(label)}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} className="tooltip-row">
          <span className="swatch" style={{ background: item.color }} />
          <span>{item.name}</span>
          <span className="tooltip-value">{shekels(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

const axisStyle = { fill: 'var(--text)', fontSize: 12 }

/** מגמת הכנסות מול הוצאות. שתי סדרות נבדלות, ולכן צבע קטגוריאלי. */
export function IncomeExpenseChart({ series }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axisStyle} tickLine={false} axisLine={false} reversed />
        <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={44} orientation="right" />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone" dataKey="totalIncome" name="הכנסות"
          stroke="var(--series-1)" strokeWidth={2} isAnimationActive={false}
          dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}
        />
        <Line
          type="monotone" dataKey="totalExpenses" name="הוצאות"
          stroke="var(--series-2)" strokeWidth={2} isAnimationActive={false}
          dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * עמידה ביעד של קבוצת תקציב אחת, כאחוז מהיעד.
 * גרף נפרד לכל קבוצה (small multiples) במקום שלוש סדרות על ציר אחד,
 * כי לכל קבוצה יעד אחר ועירוב שלושתן היה הופך את הגבהים לבלתי ניתנים להשוואה.
 */
export function GroupTargetChart({ series, group, color, exceedIsGood = false }) {
  const data = series.map((point) => ({
    month: point.month,
    percent: point.groups[group].target > 0
      ? Math.round((point.groups[group].actual / point.groups[group].target) * 100)
      : 0,
    actual: point.groups[group].actual,
    target: point.groups[group].target,
  }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axisStyle} tickLine={false} axisLine={false} reversed />
        <YAxis tickFormatter={(value) => `${value}%`} tick={axisStyle} tickLine={false} axisLine={false} width={44} orientation="right" />
        <Tooltip
          cursor={{ fill: 'var(--accent-bg)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = payload[0].payload
            return (
              <div className="chart-tooltip">
                <strong>{monthLabel(label)}</strong>
                <div className="tooltip-row">
                  <span>בפועל</span>
                  <span className="tooltip-value">{shekels(point.actual)}</span>
                </div>
                <div className="tooltip-row">
                  <span>יעד</span>
                  <span className="tooltip-value">{shekels(point.target)}</span>
                </div>
                <div className="tooltip-row">
                  <span>עמידה</span>
                  <span className="tooltip-value">{point.percent}%</span>
                </div>
              </div>
            )
          }}
        />
        {/* קו ה-100% הוא הסיפור: מעליו חרגנו, מתחתיו נשאר מקום */}
        <ReferenceLine y={100} stroke="var(--text)" strokeDasharray="4 4" />
        <Bar dataKey="percent" name="עמידה ביעד" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          {data.map((point) => (
            <Cell
              key={point.month}
              fill={point.percent > 100 && !exceedIsGood ? 'var(--over)' : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

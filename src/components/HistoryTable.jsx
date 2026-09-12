import { monthLabel, shekels } from '../lib/format'

/**
 * תצוגת טבלה לכל מה שהגרפים מראים.
 * לא רק נגישות: זו הדרך היחידה לקרוא את המספר המדויק של חודש מסוים.
 */
export default function HistoryTable({ series }) {
  return (
    <div className="table-scroll">
      <table className="history-table">
        <thead>
          <tr>
            <th>חודש</th>
            <th>הכנסות</th>
            <th>הוצאות</th>
            <th>יתרה</th>
            <th>בסיס</th>
            <th>קבועות</th>
            <th>פנאי</th>
            <th>חיסכון</th>
          </tr>
        </thead>
        <tbody>
          {[...series].reverse().map((point) => (
            <tr key={point.month}>
              <th scope="row">{monthLabel(point.month)}</th>
              <td className="num">{shekels(point.totalIncome)}</td>
              <td className="num">{shekels(point.totalExpenses)}</td>
              <td className={`num ${point.balance < 0 ? 'over' : ''}`}>{shekels(point.balance)}</td>
              <td className="num">{shekels(point.baseAmount)}</td>
              <td className="num">{shekels(point.groups.fixed.actual)}</td>
              <td className="num">{shekels(point.groups.leisure.actual)}</td>
              <td className="num">{shekels(point.groups.savings.actual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

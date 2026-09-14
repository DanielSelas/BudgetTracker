import { BILLING_DAYS } from '../lib/model'

/**
 * בחירת מועד החיוב. שלושת התאריכים שחברות האשראי מציעות הם קיצורים,
 * ולידם שדה חופשי, כי אפשר לשנות תאריך מול החברה ולא כולם על אחד משלושה.
 */
export default function BillingDayField({ value, onChange, label = 'מועד החיוב' }) {
  const custom = !BILLING_DAYS.includes(Number(value))

  return (
    <div className="field">
      {label}
      <div className="cat-pills tight">
        {BILLING_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            className="cat-pill"
            aria-pressed={Number(value) === day}
            onClick={() => onChange(day)}
          >
            ב־{day} לחודש
          </button>
        ))}
        <button
          type="button"
          className="cat-pill"
          aria-pressed={custom}
          onClick={() => onChange(20)}
        >
          אחר
        </button>
      </div>

      {custom && (
        <input
          className="input num"
          type="number"
          inputMode="numeric"
          min="1"
          max="28"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}

      <span className="type-hint">
        היום בחודש שבו יורדים חיובי האשראי. אפשר לשנות בכל עת.
      </span>
    </div>
  )
}

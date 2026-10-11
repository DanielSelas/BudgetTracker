import { CATEGORIES, GOAL_CATEGORIES, GOAL_ORDER, TRIP_CATEGORIES, TRIP_ORDER } from './model'

/**
 * רשימות הקטגוריות לבחירה. משותפות למגירת ההזנה ולעריכה בשורה, כדי
 * שלא ייווצר מצב שאפשר להזין קטגוריה שאי אפשר לתקן אליה אחר כך.
 */
const toPill = (category) => ({
  category,
  // תווית קצרה כשיש, כי צ׳יפ צר מכותרת של כרטיס
  label: CATEGORIES[category].short || CATEGORIES[category].label,
})

/**
 * מה שאפשר לבחור במגירת ההזנה, כולל הכנסה.
 *
 * בלי הכנסה כאן אי אפשר היה להזין משכורת שנייה: הכפתור הראשי פותח
 * הוצאה ברגע שיש כבר הכנסה אחת, ולא הייתה שום דרך אחרת להגיע לשם.
 */
export const ENTRY_PILLS = ['income', 'fixed', 'leisure', 'fund', 'unplanned'].map(toPill)

/** בעריכת שורה קיימת: הכנסה אינה קטגוריה שמחליפים אליה הוצאה */
export const EXPENSE_PILLS = ['fixed', 'leisure', 'fund', 'unplanned'].map((category) => ({
  category,
  // תווית קצרה כשיש, כי צ׳יפ צר מכותרת של כרטיס
  label: CATEGORIES[category].short || CATEGORIES[category].label,
}))

export const TRIP_PILLS = TRIP_ORDER.map((category) => ({
  category,
  label: TRIP_CATEGORIES[category].label,
}))

export const GOAL_PILLS = GOAL_ORDER.map((category) => ({
  category,
  label: GOAL_CATEGORIES[category].label,
}))

# BudgetTracker

אפליקציית PWA למעקב הכנסות והוצאות משותף, לפי עקרון 50/30/20.

## הרצה

```bash
npm install
npm run dev        # שרת פיתוח
npm run build      # בנייה לייצור
npm run preview    # תצוגה מקדימה של הבנייה (כולל service worker)
```

## בדיקות

```bash
npm test           # לוגיקת חישוב
npm run test:rules # כללי האבטחה מול אמולטור Firestore (דורש Java)
```

## הגדרות

העתק את `.env.example` ל-`.env.local` ומלא את הערכים מ-Firebase Console →
Project settings → Your apps.

## מבנה הנתונים

```
budgets/{id}            name, ownerUid
  members/{uid}         החברוּת בפועל
users/{uid}/memberships אינדקס פרטי של התקציבים שלי
invites/{code}          budgetId, active, expiresAt
entries/{id}            budgetId, month, category, budgetGroup, סכומים
```

`budgetGroup` נגזר אוטומטית מ-`category` ואינו נבחר ידנית.
`baseAmount` אינו נשמר, הוא מחושב בכל פעם מההכנסה בפועל של אותו חודש.

## Firestore

כללי האבטחה ב-`firestore.rules` והאינדקסים ב-`firestore.indexes.json`.
פרסום ידני: Firestore Database → Rules → הדבקה → Publish.
# BudgetTracker

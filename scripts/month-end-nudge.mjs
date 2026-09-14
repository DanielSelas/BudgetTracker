/**
 * תזכורת סוף חודש. רץ מ-GitHub Actions פעם ביום, ופועל רק ביום האחרון
 * של החודש לפי שעון ישראל. אם נשאר כסף שלא הוצא, שולח לכל חבר בתקציב
 * התראה עם קישור שפותח ישירות הפקדה לקרן.
 *
 * דורש שני משתני סביבה:
 *   FIREBASE_SERVICE_ACCOUNT  תוכן ה-JSON של מפתח השירות
 *   FORCE_SEND                'true' כדי לשלוח גם כשזה לא סוף החודש (בדיקה)
 */
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { overspentGroups, summarizeMonth } from '../src/lib/model.js'

const TIME_ZONE = 'Asia/Jerusalem'
const dateIn = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)

const shekels = (value) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
  }).format(Math.round(value))

export function monthContext(now = new Date()) {
  const today = dateIn(now)
  const tomorrow = dateIn(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  return { month: today.slice(0, 7), isLastDay: today.slice(0, 7) !== tomorrow.slice(0, 7) }
}

const GROUP_LABEL = { fixed: 'קבועות', leisure: 'פנאי', savings: 'קרן' }

/**
 * שתי בשורות שונות, ולכן שתי הודעות שונות.
 * עודף הוא הזדמנות להפקיד, וחריגה היא מידע שצריך לדעת ושווה שיגיע
 * גם כשהוא לא נעים. הודעה אחת מנוסחת בעדינות לשניהם לא הייתה עושה
 * טוב לאף אחד מהם.
 */
export function nudgeFor({ member, budget, summary }) {
  const name = member.displayName?.trim()
  const greeting = name ? `היי ${name}, ` : ''

  if (summary.balance < 0) {
    const worst = overspentGroups(summary)[0]
    const where = worst ? ` הכי הרבה ב${GROUP_LABEL[worst.group] || worst.group}.` : ''
    return {
      title: `חריגה של ${shekels(-summary.balance)}`,
      body: `${greeting}ב"${budget.name}" יצא החודש יותר ממה שנכנס.${where}`,
      link: `/?nudge=review&budget=${budget.id}`,
    }
  }

  const over = overspentGroups(summary)
  if (over.length > 0) {
    const worst = over[0]
    return {
      title: `חריגה ב${GROUP_LABEL[worst.group] || worst.group}`,
      body: `${greeting}נשארתם בתוך ההכנסות ב"${budget.name}", אבל חרגתם מהיעד ב-${shekels(worst.over)}.`,
      link: `/?nudge=review&budget=${budget.id}`,
    }
  }

  return {
    title: `נשאר לכם ${shekels(summary.balance)}`,
    body: `${greeting}זה מה שלא הוצא ב"${budget.name}" החודש. להעביר לקרן?`,
    link: `/?nudge=fund&budget=${budget.id}&amount=${Math.round(summary.balance)}`,
  }
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('חסר FIREBASE_SERVICE_ACCOUNT')

  const { month, isLastDay } = monthContext()
  const force = process.env.FORCE_SEND === 'true'
  if (!isLastDay && !force) {
    console.log(`לא היום האחרון של ${month}. לא נשלח דבר.`)
    return
  }

  initializeApp({ credential: cert(JSON.parse(raw)) })
  const db = getFirestore()
  const messaging = getMessaging()

  const budgets = await db.collection('budgets').get()
  let sent = 0
  let skipped = 0

  for (const budgetDoc of budgets.docs) {
    const budget = { id: budgetDoc.id, ...budgetDoc.data() }

    const entries = await db.collection('entries')
      .where('budgetId', '==', budget.id)
      .where('month', '==', month)
      .get()

    const summary = summarizeMonth(entries.docs.map((doc) => doc.data()), {
      fixedBase: budget.baseAmount,
    })

    // בלי הכנסה אין מה לסכם בכלל. יתרה שלילית או חריגה מיעד דווקא
    // כן נשלחות: זה בדיוק המידע ששווה לדעת בסוף החודש.
    const worthSending = summary.totalIncome > 0
      && (summary.balance !== 0 || overspentGroups(summary).length > 0)
    if (!worthSending) {
      skipped += 1
      continue
    }

    const members = await budgetDoc.ref.collection('members').get()
    for (const memberDoc of members.docs) {
      const member = memberDoc.data()
      const devices = await db.collection('users').doc(memberDoc.id).collection('devices').get()
      if (devices.empty) continue

      const payload = nudgeFor({ member, budget, summary })
      for (const device of devices.docs) {
        try {
          await messaging.send({
            token: device.id,
            data: payload,
            webpush: { headers: { Urgency: 'normal', TTL: '86400' } },
          })
          sent += 1
        } catch (error) {
          // מכשיר שהוסר או שהאסימון שלו פג. מנקים כדי לא לנסות שוב מחר.
          if (
            error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-argument'
          ) {
            await device.ref.delete()
            console.log(`הוסר אסימון לא תקף של ${memberDoc.id}`)
          } else {
            console.error(`שליחה נכשלה ל-${memberDoc.id}:`, error.code || error.message)
          }
        }
      }
    }
  }

  console.log(`חודש ${month}: נשלחו ${sent} התראות, ${skipped} תקציבים דולגו.`)
}

// מיובא גם מהבדיקות, ולכן רץ רק כשמפעילים את הקובץ ישירות
if (process.argv[1]?.endsWith('month-end-nudge.mjs')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

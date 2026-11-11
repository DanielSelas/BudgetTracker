import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { parseCapture, suggestForCapture } from '../src/lib/capture.js'

/**
 * קליטה בלי לפתוח דפדפן.
 *
 * הדרך הראשונה פותחת כתובת, והאפליקציה כותבת בעצמה בהרשאות של
 * המשתמש. היא בטוחה לגמרי אבל היא נראית: הדפדפן קופץ. כאן הקיצור
 * שולח POST ברקע ונשאר באנר, וזה המחיר: צריך מי שיקבל את הבקשה
 * ויידע שזה אתה.
 *
 * ההזדהות היא אסימון ולא אסימון Firebase, כי קיצור אינו יכול
 * להתחבר. מה שהוא מרשה הוא מכוון צר ככל האפשר: ליצור שורה ממתינה
 * בתיבה, וזהו. בלי קריאה, בלי רשומות ובלי מספר אחד שחוזר בתשובה.
 * אסימון שדלף מייצר זבל שנמחק בלחיצה.
 *
 * ומאותה סיבה גם התשובה שותקת: "לא נמצא" ו"אסימון שגוי" מוחזרים
 * אותו דבר, אחרת אפשר היה לדוג מזהי תקציב דרך הבדלי הניסוח.
 */

const MAX_TEXT = 200

function admin() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('missing-service-account')
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  return getFirestore()
}

const stableTail = (seed) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6)
}

const slug = (text) =>
  String(text || '').trim().replace(/[/\\.#$[\]]/g, '').replace(/\s+/g, '-').slice(0, 24)

const todayInIsrael = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'method-not-allowed' })
  }

  // גם משורת השאילתה וגם מגוף הבקשה: קיצור ב-iOS שולח בשאילתה בשתי
  // נגיעות, וגוף JSON דורש לבנות מילון. התוצאה זהה
  const query = request.query || {}
  const body = typeof request.body === 'object' && request.body ? request.body : {}
  const pick = (key) => String(query[key] ?? body[key] ?? '').slice(0, MAX_TEXT)

  const token = pick('token')
  if (!token || token.length !== 32) {
    return response.status(401).json({ error: 'unauthorized' })
  }

  let db
  try {
    db = admin()
  } catch {
    return response.status(503).json({ error: 'capture-not-configured' })
  }

  const matches = await db.collection('budgets')
    .where('captureToken', '==', token).limit(1).get()
  if (matches.empty) return response.status(401).json({ error: 'unauthorized' })

  const budget = matches.docs[0]
  const owner = budget.get('ownerUid')
  if (!owner) return response.status(401).json({ error: 'unauthorized' })

  const text = pick('add') || pick('text')
  const parsed = text ? parseCapture(text) : { amount: 0, name: '' }
  const amount = Number(pick('amount')) || parsed.amount
  const name = (pick('name') || parsed.name).trim().slice(0, 100) || 'הוצאה'

  if (!Number.isFinite(amount) || amount <= 0) {
    // הסכום הוא מה שאי אפשר לשחזר אחר כך מהזיכרון, ולכן שורה בלעדיו
    // אינה נכתבת. הטקסט חוזר כדי שההתראה בטלפון תוכל לומר מה נשמע
    return response.status(400).json({ error: 'no-amount', heard: text })
  }

  const rawDate = pick('date')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayInIsrael()
  const suggestion = suggestForCapture(name)

  // אותו מזהה נגזר שהלקוח מייצר, כדי ששתי הדרכים לא ייצרו כפילות
  const itemId = `cap_${date}_${slug(name)}_${stableTail(`${date}|${amount}|${name}`)}`

  await budget.ref.collection('inbox').doc(itemId).set({
    name,
    amount,
    date,
    source: 'shortcut',
    // הבעלים ולא "מי ששלח": הקיצור אינו יודע מי מחזיק בו, ומסמך
    // החבר של הבעלים קיים תמיד כל עוד התקציב קיים
    createdBy: owner,
    ...(suggestion.category ? { suggestedCategory: suggestion.category } : {}),
    ...(suggestion.groupKey ? { groupKey: suggestion.groupKey } : {}),
  })

  return response.status(200).json({ ok: true, name, amount })
}

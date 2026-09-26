import Anthropic from '@anthropic-ai/sdk'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/**
 * היועץ.
 *
 * רץ בשרת ולא בדפדפן מסיבה אחת: מפתח ה-API. מפתח שנשלח ללקוח גלוי
 * לכל מי שפותח את כלי הפיתוח, וכל אחד יכול לחייב עליו.
 *
 * ומאותה סיבה הנקודה הזאת חייבת הזדהות. נקודה פתוחה עם מפתח שלנו
 * היא הזמנה לשרוף את המכסה, ולכן בלי אסימון תקין של Firebase אין
 * תשובה. אם חסרה הגדרה בשרת, התשובה היא סירוב ולא מעבר בשקט.
 */

const MODEL = 'claude-opus-5'
const MAX_TOKENS = 4000

const SYSTEM = `אתה יועץ תקציב אישי בתוך אפליקציה משפחתית. ענה בעברית, קצר ולעניין.

מה שאתה יודע על המשתמש מופיע בהודעת המערכת הבאה. זה כל מה שיש לך.

כללים:
- אל תמציא מספרים. אם נתון חסר, אמור שהוא חסר ומה צריך להזין כדי שיהיה.
- אל תבטיח. אל תגיד "כן, אתה יכול" או "לא, אתה לא יכול". אמור מה זה עולה:
  כמה חודשים זה לוקח בקצב הנוכחי, מה זה מוריד, ומה מתפנה ומתי.
- העדף מה שידוע בוודאות, כלומר התחייבויות ותאריכי סיום, על פני ממוצעים
  מההיסטוריה. ההיסטוריה כאן קצרה ולא מספיקה לעונתיות.
- אתה לא יועץ השקעות מורשה. אם נשאלת על השקעות, אמור זאת ועצור.
- בלי אימוג׳י ובלי מחמאות. זה כלי עבודה.`

function admin() {
  if (getApps().length > 0) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('missing-service-account')
  initializeApp({ credential: cert(JSON.parse(raw)) })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'method-not-allowed' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return response.status(503).json({ error: 'chat-not-configured' })
  }

  // הזדהות לפני הכל: בלי אסימון תקין לא נוגעים ב-API בכלל
  try {
    admin()
    const token = (request.headers.authorization || '').replace(/^Bearer /, '')
    if (!token) return response.status(401).json({ error: 'missing-token' })
    await getAuth().verifyIdToken(token)
  } catch (failure) {
    const code = failure?.message === 'missing-service-account' ? 503 : 401
    return response.status(code).json({ error: 'unauthorized' })
  }

  const { context = '', messages = [] } = request.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ error: 'no-messages' })
  }

  const client = new Anthropic()

  try {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // ההוראות קודם וההקשר אחריהן, ושתיהן יציבות בתוך שיחה אחת.
      // זה מה שמאפשר למטמון לתפוס, כי רק ההודעות משתנות
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
      ],
      messages: messages
        .filter((item) => item && typeof item.content === 'string')
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content.slice(0, 4000),
        })),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        response.write(event.delta.text)
      }
    }

    const final = await stream.finalMessage()
    // סירוב מטעמי בטיחות מגיע כתשובה תקינה ולא כשגיאה, ובלי הבדיקה
    // הזאת המשתמש מקבל מסך ריק בלי לדעת למה
    if (final.stop_reason === 'refusal' && !response.writableEnded) {
      response.write('\n\nלא אוכל לענות על זה.')
    }
    return response.end()
  } catch (failure) {
    if (response.headersSent) {
      response.write('\n\nהחיבור נקטע. נסו שוב.')
      return response.end()
    }
    const status = failure?.status === 429 ? 429 : 502
    return response.status(status).json({ error: 'upstream' })
  }
}

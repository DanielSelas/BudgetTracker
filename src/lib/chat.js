import { getAuth } from 'firebase/auth'

/**
 * הקריאה ליועץ.
 *
 * מחזירה את התשובה בזרימה, כי תשובה שמופיעה מילה אחר מילה נראית
 * מהירה בהרבה מאותה תשובה שמופיעה בבת אחת אחרי המתנה שקטה.
 */
export async function askAdvisor({ context, messages, onText, signal }) {
  const user = getAuth().currentUser
  if (!user) throw new Error('not-signed-in')
  // אסימון טרי: הנקודה בשרת מאמתת אותו, ואסימון שפג נדחה
  const token = await user.getIdToken()

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ context, messages }),
    signal,
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    throw new Error(problem.error || 'failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onText?.(full)
  }
  return full
}

/** הודעות השגיאה, כדי שהמסך יגיד מה קרה ולא "משהו נכשל". */
export const CHAT_ERRORS = {
  'chat-not-configured': 'היועץ עוד לא הוגדר בשרת. חסר מפתח API.',
  'not-signed-in': 'צריך להתחבר מחדש.',
  unauthorized: 'ההזדהות נכשלה. התחברו מחדש ונסו שוב.',
  upstream: 'השירות לא זמין כרגע. נסו שוב בעוד רגע.',
  429: 'יותר מדי בקשות. נסו שוב בעוד דקה.',
}

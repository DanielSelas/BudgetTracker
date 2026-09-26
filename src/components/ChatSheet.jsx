import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { CHAT_ERRORS, askAdvisor } from '../lib/chat'

/**
 * שיחה עם היועץ.
 *
 * מה שנשלח הוא תמונה מסוכמת של התקציב, לא רשימת עסקאות. השיחה
 * אינה נשמרת: היא נפתחת ריקה בכל פעם, כי היא כלי לשאלה אחת ולא
 * יומן, ושמירה שלה הייתה אומרת לשמור מידע פיננסי בעוד מקום.
 */
const SUGGESTIONS = [
  'אני רוצה לטוס לחו״ל בקיץ, כמה זה ריאלי?',
  'מה הכי כדאי לי לצמצם החודש?',
  'אם אפסיק הוצאה קבועה, מה זה משנה?',
]

export default function ChatSheet({ context, onClose }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)
  const abort = useRef(null)

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [messages, streaming])

  async function send(text) {
    const question = text.trim()
    if (!question || busy) return

    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setDraft('')
    setStreaming('')
    setError('')
    setBusy(true)

    abort.current = new AbortController()
    try {
      const answer = await askAdvisor({
        context,
        messages: next,
        onText: setStreaming,
        signal: abort.current.signal,
      })
      setMessages([...next, { role: 'assistant', content: answer }])
    } catch (failure) {
      if (failure.name !== 'AbortError') {
        setError(CHAT_ERRORS[failure.message] || 'לא הצלחתי לענות. נסו שוב.')
      }
    }
    setStreaming('')
    setBusy(false)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-form chat">
        <h2>שאלה על התקציב</h2>

        {messages.length === 0 && !busy && (
          <>
            <p className="hint">
              היועץ רואה תמונה מסוכמת של התקציב: הכנסות, התחייבויות
              קבועות, מה פנוי בחודשים הקרובים וההוצאות הגדולות. הוא
              לא רואה עסקאות בודדות.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion} type="button" className="cat-pill"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="chat-log">
          {messages.map((message, index) => (
            <p key={index} className={`bubble ${message.role}`}>{message.content}</p>
          ))}
          {streaming && <p className="bubble assistant">{streaming}</p>}
          {busy && !streaming && <p className="bubble assistant thinking">חושב...</p>}
          <span ref={bottom} />
        </div>

        {error && <p className="notice block" role="alert">{error}</p>}

        <form
          className="chat-compose"
          onSubmit={(event) => { event.preventDefault(); send(draft) }}
        >
          <input
            className="input"
            placeholder="מה תרצו לשאול?"
            maxLength={500}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
            שליחה
          </button>
        </form>

        <span className="type-hint">
          התשובות מבוססות על מה שהוזן באפליקציה, והן לא ייעוץ פיננסי מקצועי.
        </span>
      </div>
    </Sheet>
  )
}

import { useState } from 'react'
import Sheet from './Sheet'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import { TONES, TONE_LABEL, defaultTone, saveProfile } from '../lib/profile'

/**
 * הפרופיל: שם וגוון, מקור אמת אחד לכל התקציבים.
 *
 * הגוון אינו קישוט. שני אנשים ששמם מתחיל באותה אות נראים זהים כשיש
 * רק אות ראשונה, ולכן הצבע הוא מה שמבדיל ביניהם בכל שורה שהוזנה.
 */
export default function ProfileSheet({ profile, onClose }) {
  const { user } = useAuth()
  const fallbackName = user.displayName || user.email?.split('@')[0] || ''
  const [name, setName] = useState(profile?.displayName || fallbackName)
  const [tone, setTone] = useState(profile?.tone || defaultTone(user.uid))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = name.trim()
  const preview = { uid: user.uid, displayName: clean || fallbackName }

  async function submit(event) {
    event.preventDefault()
    if (!clean) {
      setError('צריך שם')
      return
    }
    setBusy(true)
    try {
      await saveProfile(user.uid, { displayName: clean, tone })
      onClose()
    } catch {
      setError('השמירה נכשלה')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form className="sheet-form" onSubmit={submit}>
        <h2>הפרופיל שלי</h2>

        <div className="profile-preview">
          <Avatar member={preview} profile={{ tone }} size="lg" />
          <div>
            <strong>{clean || fallbackName}</strong>
            <span className="hint">{user.email}</span>
          </div>
        </div>

        <label className="field">
          השם שלי
          <input
            className="input"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <span className="type-hint">
            כך תופיע בכל התקציבים, גם אצל מי שמשתף איתך.
          </span>
        </label>

        <div className="field">
          הצבע שלי
          <div className="tone-picker">
            {TONES.map((option) => (
              <button
                key={option}
                type="button"
                className={`tone ${option}`}
                aria-pressed={tone === option}
                aria-label={TONE_LABEL[option]}
                title={TONE_LABEL[option]}
                onClick={() => setTone(option)}
              />
            ))}
          </div>
          <span className="type-hint">
            מבדיל בינך לבין שותף ששמו מתחיל באותה אות.
          </span>
        </div>

        {error && <p className="notice block" role="alert">{error}</p>}

        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={busy || !clean}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Sheet>
  )
}

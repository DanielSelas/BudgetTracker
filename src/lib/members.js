import { defaultTone } from './profile'

/** סדר קבוע: הבעלים ראשון, אחריו לפי סדר ההצטרפות. */
export function sortMembers(members) {
  if (!members) return []
  return [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return (a.joinedAt?.seconds ?? 0) - (b.joinedAt?.seconds ?? 0)
  })
}

/**
 * שם וגוון מגיעים מהפרופיל כשיש אחד, ואחרת ממסמך החבר כמו קודם.
 * זו הקריאה הכפולה שמאפשרת למיגרציה להיות תוספתית בלבד: אף שדה
 * קיים לא נמחק, והפרופיל פשוט גובר עליו כשהוא קיים.
 */
export function displayName(member, profile) {
  if (profile?.displayName) return profile.displayName
  if (!member) return 'שותף'
  return member.displayName || member.email?.split('@')[0] || 'שותף'
}

export function avatarTone(member, profile) {
  if (profile?.tone) return profile.tone
  return defaultTone(member?.uid || '')
}

export function initial(member, profile) {
  const name = displayName(member, profile).trim()
  return name ? name[0] : '?'
}

/** ממפה uid לחבר, למקומו ברשימה ולפרופיל שלו. */
export function memberIndex(members, profiles = {}) {
  const sorted = sortMembers(members)
  const map = new Map()
  sorted.forEach((member, index) => {
    map.set(member.uid, { member, index, profile: profiles[member.uid] ?? null })
  })
  return { sorted, get: (uid) => map.get(uid) ?? null }
}

/** "דניאל ונועה" / "דניאל, נועה ועוד 2" */
export function membersSentence(members, profiles = {}) {
  const names = sortMembers(members).map((member) => displayName(member, profiles[member.uid]))
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} ו${names[1]}`
  return `${names.slice(0, 2).join(', ')} ועוד ${names.length - 2}`
}

/**
 * משלים שם חסר במסמך החבר. חברים שנוצרו לפני שהשדה הזה נוסף מוצגים
 * כ"שותף", וזה מתקן את עצמו בכניסה הבאה בלי שהמשתמש יעשה דבר.
 */
export function needsDisplayName(member, name) {
  if (!member || !name) return false
  return member.displayName !== name
}

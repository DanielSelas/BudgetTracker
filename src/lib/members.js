/** סדר קבוע: הבעלים ראשון, אחריו לפי סדר ההצטרפות. */
export function sortMembers(members) {
  if (!members) return []
  return [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return (a.joinedAt?.seconds ?? 0) - (b.joinedAt?.seconds ?? 0)
  })
}

/** גוון האווטאר נקבע לפי המקום ברשימה, כך שהוא יציב לאורך זמן. */
const TONES = ['a1', 'a2', 'a3']
export const avatarTone = (index) => TONES[index % TONES.length]

export function displayName(member) {
  if (!member) return 'שותף'
  return member.displayName || member.email?.split('@')[0] || 'שותף'
}

export function initial(member) {
  const name = displayName(member).trim()
  return name ? name[0] : '?'
}

/** ממפה uid לחבר ולמקומו ברשימה, לצורך שם וצבע. */
export function memberIndex(members) {
  const sorted = sortMembers(members)
  const map = new Map()
  sorted.forEach((member, index) => map.set(member.uid, { member, index }))
  return { sorted, get: (uid) => map.get(uid) ?? null }
}

/** "דניאל ונועה" / "דניאל, נועה ועוד 2" */
export function membersSentence(members) {
  const names = sortMembers(members).map(displayName)
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

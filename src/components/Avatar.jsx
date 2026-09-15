import { avatarTone, initial } from '../lib/members'

export default function Avatar({ member, profile = null, size = '', stacked = false, title }) {
  const classes = ['avatar', avatarTone(member, profile), size, stacked ? 'stacked' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} title={title} aria-hidden={!title}>
      {initial(member, profile)}
    </span>
  )
}

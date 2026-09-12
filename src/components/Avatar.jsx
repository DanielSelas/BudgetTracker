import { avatarTone, initial } from '../lib/members'

export default function Avatar({ member, index = 0, size = '', stacked = false, title }) {
  const classes = ['avatar', avatarTone(index), size, stacked ? 'stacked' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} title={title} aria-hidden={!title}>
      {initial(member)}
    </span>
  )
}

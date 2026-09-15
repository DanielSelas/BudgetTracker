import { useEffect, useMemo, useRef, useState } from 'react'
import { watchProfile } from '../lib/profile'

/**
 * מאזין לפרופילים של קבוצת משתמשים.
 *
 * מספר האנשים בתקציב קטן, ולכן האזנה ישירה לכל אחד פשוטה יותר
 * משמירת עותק של השם בכל תקציב, והיא גם מעדכנת מיד: מי שמשנה את
 * השם שלו רואה אותו משתנה אצל השותף בלי רענון.
 */
export function useProfiles(uids = []) {
  const [profiles, setProfiles] = useState({})
  const watching = useRef(new Map())

  // מפתח יציב, אחרת מערך חדש בכל רינדור היה מנתק ומחבר בלי סוף
  const key = useMemo(() => [...new Set(uids.filter(Boolean))].sort().join(','), [uids])

  useEffect(() => {
    const wanted = new Set(key ? key.split(',') : [])

    for (const [uid, unsubscribe] of watching.current) {
      if (!wanted.has(uid)) {
        unsubscribe()
        watching.current.delete(uid)
      }
    }

    for (const uid of wanted) {
      if (watching.current.has(uid)) continue
      watching.current.set(uid, watchProfile(
        uid,
        (profile) => setProfiles((current) => ({ ...current, [uid]: profile })),
        () => {},
      ))
    }
  }, [key])

  useEffect(() => {
    const open = watching.current
    return () => {
      for (const unsubscribe of open.values()) unsubscribe()
      open.clear()
    }
  }, [])

  return profiles
}

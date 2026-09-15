import { useEffect, useRef, useState } from 'react'
import { defaultTone, saveProfile, watchProfile } from '../lib/profile'

/**
 * הפרופיל שלי, ויצירה שלו בכניסה הראשונה.
 *
 * בלי זה מסמך המשתמש נשאר ריק עד שמישהו טורח לפתוח את מסך הפרופיל,
 * ובקונסולה רואים שורת מזהה בלי שום דרך לדעת מי זה. עכשיו לכל מי
 * שמתחבר יש שם כבר מהרגע הראשון.
 *
 * השם נלקח מההזדהות, ולכן מי שנרשם עם גוגל מקבל את שמו המלא מיד.
 * אפשר לשנות אותו אחר כך, וזה לא ייכתב שוב.
 */
export function useOwnProfile(user) {
  const [profile, setProfile] = useState(null)
  const seeded = useRef(false)

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null)
      return
    }
    seeded.current = false

    return watchProfile(
      user.uid,
      (found) => {
        setProfile(found)
        if (found || seeded.current) return
        seeded.current = true
        saveProfile(user.uid, {
          displayName: user.displayName || user.email?.split('@')[0] || 'אני',
          tone: defaultTone(user.uid),
        }).catch(() => {
          // לא קריטי. הפרופיל ייווצר בפעם הבאה, או ידנית במסך
        })
      },
      () => {},
    )
  }, [user])

  return profile
}

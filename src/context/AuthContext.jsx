import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

// מיוצא כדי שאפשר יהיה להרכיב אותו בבדיקות רינדור
export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),

      /**
       * הרשמה עם שם. השם נשמר בפרופיל ומשם הוא מגיע לאווטארים
       * ולשורת "מי הזין". onAuthStateChanged כבר ירה לפני שהשם נכתב,
       * ולכן צריך לרענן את המצב ידנית, אחרת המשתמש יופיע בלי שם.
       */
      signUp: async (email, password, name) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        const trimmed = name.trim()
        if (trimmed) {
          await updateProfile(credential.user, { displayName: trimmed })
          setUser(Object.assign(Object.create(Object.getPrototypeOf(auth.currentUser)), auth.currentUser))
        }
        return credential.user
      },
      signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
      signOut: () => firebaseSignOut(auth),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

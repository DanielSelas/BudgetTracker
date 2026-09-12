const MESSAGES = {
  'auth/invalid-email': 'כתובת האימייל אינה תקינה',
  'auth/invalid-credential': 'אימייל או סיסמה שגויים',
  'auth/wrong-password': 'אימייל או סיסמה שגויים',
  'auth/user-not-found': 'אימייל או סיסמה שגויים',
  'auth/user-disabled': 'המשתמש הזה חסום',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות',
  'auth/network-request-failed': 'אין חיבור לאינטרנט',
  'auth/popup-blocked': 'הדפדפן חסם את חלון ההתחברות. אפשר חלונות קופצים ונסה שוב',
  'auth/account-exists-with-different-credential': 'לאימייל הזה כבר קיים חשבון עם שיטת התחברות אחרת',
  'auth/unauthorized-domain': 'הדומיין הזה לא מאושר ב-Firebase Auth',
}

export function authErrorMessage(error) {
  return MESSAGES[error?.code] || 'ההתחברות נכשלה. נסה שוב'
}

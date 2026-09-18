import { describe, expect, it, vi } from 'vitest'
import { isStaleBuildError, recoverOnce, watchForStaleBuild } from '../src/lib/freshBuild'

/**
 * האפליקציה מותקנת כ-PWA, ולכן דף שנטען לפני פריסה חדשה ממשיך לחיות
 * אחריה ומצביע על קבצים שנמחקו. זה מתגלה רק בטעינה עצלה, כלומר
 * ברגע שלוחצים על משהו, ולכן הוא לא נתפס בפתיחת האפליקציה.
 */
describe('התאוששות מגרסה תקועה', () => {
  it('מזהה את השגיאה לפי הצורות שהדפדפנים מחזירים', () => {
    expect(isStaleBuildError({
      message: "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of 'text/html'.",
    })).toBe(true)
    expect(isStaleBuildError({
      message: 'Failed to fetch dynamically imported module: /assets/xlsx-a1b2.js',
    })).toBe(true)
    expect(isStaleBuildError({ message: 'Importing a module script failed.' })).toBe(true)
  })

  it('ולא מבלבל אותה עם קובץ פגום', () => {
    expect(isStaleBuildError({ message: 'invalid zip data' })).toBe(false)
    expect(isStaleBuildError({ message: 'הקובץ נקרא אבל לא נמצאו בו שורות' })).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
  })

  it('טוען מחדש פעם אחת ולא נכנס ללולאה', () => {
    sessionStorage.clear()
    const start = 1_000_000
    expect(recoverOnce(start)).toBe(true)
    // ניסיון נוסף מיד אחריו הוא בדיוק הלולאה שצריך למנוע
    expect(recoverOnce(start + 500)).toBe(false)
    expect(recoverOnce(start + 29_000)).toBe(false)
    // אחרי שהשקט עבר, כישלון חדש הוא כישלון אמיתי וראוי לניסיון
    expect(recoverOnce(start + 31_000)).toBe(true)
  })

  it('אירוע הטעינה העצלה מפעיל טעינה מחדש', () => {
    sessionStorage.clear()
    const listeners = {}
    const reload = vi.fn()
    const target = {
      addEventListener: (name, handler) => { listeners[name] = handler },
      location: { reload },
    }
    watchForStaleBuild(target)
    listeners['vite:preloadError']({ preventDefault: vi.fn() })
    expect(reload).toHaveBeenCalledTimes(1)

    // האירוע חוזר על עצמו כשכמה קבצים נכשלים, וזו לא סיבה לטעון שוב
    listeners['vite:preloadError']({ preventDefault: vi.fn() })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

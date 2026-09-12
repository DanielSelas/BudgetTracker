import { useEffect, useRef, useState } from 'react'

const DISMISS_DISTANCE = 110

/**
 * מגירה תחתונה. שלושה דברים שלא מובנים מאליהם בנייד:
 *
 * 1. נעילת גלילת הרקע. בלעדיה iOS מגלגל את הדף שמאחור במקום את המגירה.
 * 2. גובה לפי visualViewport ולא svh. כשהמקלדת נפתחת ב-iOS היחידה svh
 *    לא משתנה, ולכן תחתית המגירה נשארת מתחת למקלדת בלי דרך להגיע אליה.
 * 3. גרירה כלפי מטה לסגירה. הידית האפורה מבטיחה את זה ויזואלית.
 */
export default function Sheet({ onClose, children }) {
  const sheetRef = useRef(null)
  const dragStart = useRef(null)
  // המרחק נשמר גם ב-ref: state של React מתעדכן אסינכרונית, ואם pointerup
  // מגיע באותו tick כמו pointermove הסף ייבדק מול ערך ישן.
  const dragDelta = useRef(0)
  const [dragY, setDragY] = useState(0)
  const [maxHeight, setMaxHeight] = useState('92svh')

  // נעילת גלילת הרקע כל עוד המגירה פתוחה.
  // ספארי באייפון מתעלם מ-overflow: hidden על ה-body, ולכן הדרך היחידה
  // שעובדת היא להוציא אותו מהזרימה עם position: fixed ולשמר את מיקום
  // הגלילה ידנית, אחרת הדף קופץ לראש ברגע שהמגירה נסגרת.
  useEffect(() => {
    const { body } = document
    const scrollY = window.scrollY
    const saved = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      Object.assign(body.style, saved)
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setMaxHeight(`${Math.round(viewport.height * 0.92)}px`)
    update()
    viewport.addEventListener('resize', update)
    return () => viewport.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePointerDown(event) {
    // גרירה מתחילה רק כשהמגירה כבר בראש התוכן, אחרת היא מתנגשת בגלילה הפנימית
    if (sheetRef.current?.scrollTop > 0) return
    if (event.target.closest('input, button, select, textarea')) return
    dragStart.current = event.clientY
    dragDelta.current = 0
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // דפדפנים מסוימים דוחים לכידה על מצביע שכבר שוחרר. הגרירה עובדת גם בלעדיה.
    }
  }

  function handlePointerMove(event) {
    if (dragStart.current === null) return
    dragDelta.current = Math.max(0, event.clientY - dragStart.current)
    setDragY(dragDelta.current)
  }

  function handlePointerUp() {
    if (dragStart.current === null) return
    const distance = dragDelta.current
    dragStart.current = null
    dragDelta.current = 0
    setDragY(0)
    if (distance > DISMISS_DISTANCE) onClose()
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragStart.current === null ? 'transform 200ms var(--ease-soft)' : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="sheet-handle" />
        {children}
      </div>
    </div>
  )
}

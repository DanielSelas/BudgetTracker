import { useEffect, useRef, useState } from 'react'
import { materialize, pendingTemplates, watchTemplates } from '../lib/recurring'

/**
 * מאזין לתבניות החיובים הקבועים וממלא אוטומטית את השורות החסרות בחודש המוצג.
 */
export function useRecurring({ budgetId, month, uid, entries, entriesLoaded }) {
  const [templates, setTemplates] = useState([])
  const [error, setError] = useState(null)
  // חודשים שכבר מילאנו במושב הזה, כדי לא לנסות שוב בכל רינדור
  const filled = useRef(new Set())

  useEffect(() => {
    if (!budgetId) return
    setTemplates([])
    filled.current = new Set()
    return watchTemplates(budgetId, setTemplates, setError)
  }, [budgetId])

  useEffect(() => {
    if (!budgetId || !month || !entriesLoaded) return

    const pending = pendingTemplates(templates, entries, month)
    if (pending.length === 0) return

    const key = `${budgetId}:${month}:${pending.map((item) => item.id).sort().join(',')}`
    if (filled.current.has(key)) return
    filled.current.add(key)

    materialize(pending, { budgetId, month, uid }).catch(setError)
  }, [budgetId, month, uid, templates, entries, entriesLoaded])

  return { templates, error }
}

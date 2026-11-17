import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import BaseAmountDialog from '../src/components/BaseAmountDialog'

afterEach(cleanup)

const open = (props = {}) => render(
  <BaseAmountDialog value={20000} onSave={() => {}} onCancel={() => {}} {...props} />,
)

const ratioInputs = (container) => [...container.querySelectorAll('.ratio-input')]

// סימני כיווניות נכנסים לפורמט המטבע ואינם מעניינים כאן
const money = (container) => [...container.querySelectorAll('.entry-amount')]
  .map((cell) => cell.textContent.replace(/[^\d,]/g, ''))

describe('עריכת החלוקה', () => {
  it('מתחיל מהיחסים של התקציב ומראה את הסכומים', () => {
    const { container } = open({ ratios: { fixed: 0.4, leisure: 0.4, savings: 0.2 } })
    expect(ratioInputs(container).map((input) => input.value)).toEqual(['40', '40', '20'])
    expect(money(container)).toEqual(['8,000', '8,000', '4,000'])
  })

  it('סכום שאינו 100% חוסם שמירה ואומר למה', () => {
    const { container } = open()
    fireEvent.change(ratioInputs(container)[1], { target: { value: '50' } })
    expect(container.querySelector('.hint.warn').textContent).toContain('120%')
    expect(container.querySelector('.btn-primary').disabled).toBe(true)
  })

  it('הסכומים נקראים מיד בשקלים כשמזיזים אחוז', () => {
    const { container } = open()
    fireEvent.change(ratioInputs(container)[0], { target: { value: '40' } })
    fireEvent.change(ratioInputs(container)[1], { target: { value: '40' } })
    expect(money(container)[0]).toBe('8,000')
    expect(container.querySelector('.btn-primary').disabled).toBe(false)
  })

  it('שומר את הבסיס ואת היחסים כשברים', () => {
    const onSave = vi.fn()
    const { container } = open({ onSave })
    fireEvent.change(ratioInputs(container)[0], { target: { value: '40' } })
    fireEvent.change(ratioInputs(container)[1], { target: { value: '40' } })
    fireEvent.submit(container.querySelector('.dialog'))
    expect(onSave).toHaveBeenCalledWith(20000, { fixed: 0.4, leisure: 0.4, savings: 0.2 })
  })

  it('אומר שחודש שעבר אינו משתנה, ומאיזה חודש השינוי חל', () => {
    const { container } = open({ appliesFrom: '2026-11' })
    expect(container.textContent).toContain('נובמבר')
    expect(container.textContent).toContain('חודשים שכבר עברו נשארים כפי שהיו')
  })
})

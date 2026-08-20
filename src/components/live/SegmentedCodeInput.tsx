import { useRef, useCallback, useEffect } from 'react'
import { cn } from '../../utils/cn'

/**
 * SegmentedCodeInput — 6 separate digit inputs for room code entry.
 * Auto-focuses between digits, supports paste, RTL-aware.
 * Each digit is a separate input for maximum mobile friendliness.
 */
export function SegmentedCodeInput({
  value,
  onChange,
  disabled,
  english,
  autoFocus = true,
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  english: boolean
  autoFocus?: boolean
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Pad value to 6 digits
  const digits = value.padEnd(6, '').slice(0, 6).split('')

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(5, index))
    inputRefs.current[clamped]?.focus()
    inputRefs.current[clamped]?.select()
  }, [])

  const handleChange = useCallback((index: number, digit: string) => {
    // Only allow digits
    const cleaned = digit.replace(/[^0-9]/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = cleaned
    const newValue = newDigits.join('')
    onChange(newValue)

    // Auto-focus next input
    if (cleaned && index < 5) {
      focusInput(index + 1)
    }
  }, [digits, onChange, focusInput])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // If current is empty and backspace, move to previous
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      onChange(newDigits.join(''))
      focusInput(index - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusInput(index + 1)
      e.preventDefault()
    }
  }, [digits, onChange, focusInput])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
    if (pasted) {
      onChange(pasted)
      // Focus the last filled input or the next empty one
      focusInput(Math.min(pasted.length, 5))
    }
  }, [onChange, focusInput])

  // Auto-focus first empty input on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmpty = digits.findIndex((d) => !d)
      focusInput(firstEmpty >= 0 ? firstEmpty : 0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('flex gap-2', english ? 'flex-row' : 'flex-row-reverse')} dir="ltr">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          className={cn(
            'w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-2 text-center font-display text-2xl sm:text-3xl font-black',
            'outline-none transition-all duration-150',
            digit
              ? 'border-gold bg-gold/10 text-gold-bright shadow-glow-gold'
              : 'border-petro-line-strong bg-petro-800/80 text-cream',
            'focus:border-gold focus:bg-gold/10 focus:shadow-glow-gold focus:scale-105',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label={`${english ? 'Digit' : 'رقم'} ${i + 1}`}
        />
      ))}
    </div>
  )
}

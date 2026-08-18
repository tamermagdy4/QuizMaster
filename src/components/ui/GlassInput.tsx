import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Dark variant — used on the navy game-show stage. */
  dark?: boolean
}
export function GlassInput({ label, className, id, dark = false, ...props }: GlassInputProps) {
  const inputId = id ?? (label || undefined)
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className={cn('block text-sm font-bold', dark ? 'text-cream/80' : 'text-ink-2')}>
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          'w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-muted/70',
          dark
            ? 'input-dark'
            : 'border-border-strong bg-white text-ink focus:border-navy focus:ring-2 focus:ring-navy/15',
          className,
        )}
        {...props}
      />
    </div>
  )
}

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
      <label htmlFor={inputId} className={cn('block text-xs font-bold sm:text-sm', dark ? 'text-slate-300' : 'text-ink-2')}>
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          'w-full rounded-xl border px-4 py-3 outline-none transition',
          dark
            ? 'border-[#223147] bg-[#090e15] text-white placeholder-slate-500 focus:border-[#c69c46] focus:ring-2 focus:ring-[#c69c46]/20'
            : 'border-border-strong bg-white text-ink placeholder:text-muted/70 focus:border-navy focus:ring-2 focus:ring-navy/15',
          className,
        )}
        {...props}
      />
    </div>
  )
}

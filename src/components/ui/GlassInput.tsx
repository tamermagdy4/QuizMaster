import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function GlassInput({ label, className, id, ...props }: GlassInputProps) {
  const inputId = id ?? label

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-white/80">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white',
          'placeholder:text-white/35 outline-none transition',
          'focus:border-gold-400/50 focus:bg-white/8 focus:ring-2 focus:ring-gold-400/20',
          className,
        )}
        {...props}
      />
    </div>
  )
}

import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> { label: string }
export function GlassInput({ label, className, id, ...props }: GlassInputProps) { const inputId = id ?? (label || undefined); return <div className="space-y-2"><label htmlFor={inputId} className="block text-sm font-bold text-slate-300">{label}</label><input id={inputId} className={cn('w-full rounded-xl border border-white/10 bg-[#08182d] px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10', className)} {...props} /></div> }

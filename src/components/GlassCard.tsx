import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
interface GlassCardProps { children: ReactNode; className?: string; strong?: boolean }
export function GlassCard({ children, className, strong = false }: GlassCardProps) { return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }} className={cn(strong ? 'rounded-3xl border border-cyan-300/15 bg-[#0d2038]/90 p-6 shadow-2xl shadow-black/20' : 'rounded-2xl border border-white/10 bg-white/[.04] p-6 shadow-xl shadow-black/10 backdrop-blur-xl', className)}>{children}</motion.div> }

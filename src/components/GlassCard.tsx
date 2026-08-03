import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface GlassCardProps {
  children: ReactNode
  className?: string
  strong?: boolean
}

export function GlassCard({ children, className, strong = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(strong ? 'glass-panel-strong' : 'glass-panel', 'rounded-2xl p-6', className)}
    >
      {children}
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface GlassCardProps {
  children: ReactNode
  className?: string
  strong?: boolean
  /** Show the thin gold hairline on the top edge (scores / winner). */
  goldEdge?: boolean
  /** Delay (seconds) before the card fades/slides in — used for stagger. */
  delay?: number
}

/**
 * The base light surface of فهلوي. Every panel in the app should look like
 * part of the same product — white card, soft border, restrained shadow,
 * optional gold hairline for premium states.
 */
export function GlassCard({ children, className, strong = false, goldEdge = false, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        strong ? 'glass-panel-strong' : 'glass-panel',
        goldEdge && 'panel-gold-edge',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

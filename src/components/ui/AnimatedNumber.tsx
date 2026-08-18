import { motion, useAnimation, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { cn } from '../../utils/cn'

interface AnimatedNumberProps {
  value: number
  className?: string
  /** Small scale "bump" whenever the value changes. Defaults to true. */
  pulse?: boolean
  /**
   * Start counting from this value on first mount (e.g. `from={0}` on the
   * Results page so scores count up from zero). When omitted the number
   * simply animates between live value changes.
   */
  from?: number
}

/**
 * Counts smoothly from the previous value to the new one instead of snapping,
 * with a tiny scale bump on change. The span never re-mounts on value change
 * (no layout shift), and it uses `tabular-nums` so the digits do not jiggle
 * the layout while counting.
 */
export function AnimatedNumber({ value, className, pulse = true, from }: AnimatedNumberProps) {
  const start = from ?? value
  const motionValue = useMotionValue(start)
  const spring = useSpring(motionValue, { stiffness: 140, damping: 22 })
  const controls = useAnimation()
  const textRef = useRef<HTMLSpanElement>(null)
  const prevRef = useRef(start)

  useEffect(() => {
    motionValue.set(value)
    if (value !== prevRef.current && pulse) {
      void controls.start({
        scale: [1, 1.08, 1],
        transition: { duration: 0.4, ease: 'easeOut' },
      })
    }
    prevRef.current = value
  }, [value, motionValue, controls, pulse])

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (textRef.current) textRef.current.textContent = String(Math.round(latest))
    })
  }, [spring])

  return (
    <motion.span animate={controls} className={cn('inline-block tabular-nums', className)}>
      <span ref={textRef}>{value}</span>
    </motion.span>
  )
}

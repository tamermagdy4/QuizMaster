import { useRef, type ReactNode } from 'react'
import { useScroll, useSpring, type MotionValue } from 'framer-motion'
import { cn } from '../../utils/cn'

/**
 * فهلوي — ScrollStage
 *
 * A full-viewport sticky stage driven by scroll progress. The page is
 * one tall scroll container (default 800vh); the stage sticks to the
 * viewport and hands a single `progress` MotionValue (0→1) to its
 * children, which act as the "camera" through the cinematic scenes.
 *
 * Numeric offsets force the JS tracking path (equivalent to
 * ['start start', 'end end']).
 *
 * Transforms/opacity only — no layout-affecting animations.
 */

interface ScrollStageProps {
  /** Total scroll height of the stage — a Tailwind arbitrary class, e.g. 'h-[800vh]'. */
  height?: string
  children: (progress: MotionValue<number>) => ReactNode
}

export function ScrollStage({ height = 'h-[800vh]', children }: ScrollStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: [0, 1] })
  // Slightly damped so scene changes glide instead of snapping.
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.5 })

  return (
    <div ref={stageRef} className={cn('relative w-full', height)}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">{children(progress)}</div>
    </div>
  )
}

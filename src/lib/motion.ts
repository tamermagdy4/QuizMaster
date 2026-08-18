import type { Transition, Variants } from 'framer-motion'

/**
 * فهلوي — one motion language.
 * Micro-interactions are fast (120–220ms), scene transitions slower (350–450ms).
 * Exit is always faster than enter. Respect reduced-motion via MotionConfig.
 */

export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const
export const EASE_SNAPPY = [0.3, 0.9, 0.4, 1] as const

export const transition = {
  fade: { duration: 0.22, ease: EASE_OUT_QUART } satisfies Transition,
  micro: { duration: 0.12, ease: EASE_SNAPPY } satisfies Transition,
  enter: { duration: 0.32, ease: EASE_OUT_QUART } satisfies Transition,
  scene: { duration: 0.42, ease: EASE_OUT_QUART } satisfies Transition,
}

/** Fade + rise — used for panels, cards, and content blocks. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT_QUART } },
}

/** Pop-in with a slight overshoot-free scale — modals, dialogs, winner cards. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT_QUART } },
}

/** Container stagger — pass to a parent motion.div, children use fadeUp. */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
})

/** Press micro-interaction for buttons/cells. */
export const tapScale = { scale: 0.96 }

/** Answer/score flash — a quick emphasis pulse. */
export const emphasis: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: [1, 1.04, 1],
    transition: { duration: 0.4, times: [0, 0.55, 1], ease: EASE_OUT_QUART },
  },
}

export const pageTransition: Transition = {
  duration: 0.28,
  ease: EASE_OUT_QUART,
}

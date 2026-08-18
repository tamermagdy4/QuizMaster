import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'

/**
 * Branded cinematic loader shown while a lazy route chunk loads — the
 * Fahloy mark rises out of a mask, a gold line sweeps, then the wordmark
 * settles. transform/opacity only; respects reduced motion via MotionConfig
 * + the app's motion guard.
 */
export function PageLoader() {
  const english = useAppStore((state) => state.language === 'en')

  return (
    <div
      className="flex min-h-[45vh] flex-col items-center justify-center gap-5 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <motion.span
          initial={{ opacity: 0, y: 18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy font-display text-xl font-extrabold text-white shadow-[0_16px_36px_rgba(18,59,70,0.3)]"
        >
          س
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.25, 1, 0.5, 1] }}
          className="font-display text-2xl font-extrabold text-navy"
        >
          فهلوي
        </motion.span>
      </div>

      {/* gold line sweep */}
      <div className="relative h-[2px] w-40 overflow-hidden rounded-full bg-navy/10">
        <motion.span
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent"
          aria-hidden
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-sm font-bold text-muted"
      >
        {english ? 'Loading…' : 'جارٍ التحميل…'}
      </motion.p>
    </div>
  )
}

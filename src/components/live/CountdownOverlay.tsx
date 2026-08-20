import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * CountdownOverlay — shows a 3-2-1-GO countdown between lobby and gameplay.
 * Uses the same dark petroleum background as the rest of the app.
 */
export function CountdownOverlay({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) {
      onComplete()
      return
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [count, onComplete])

  const labels: Record<number, { text: string; emoji: string; color: string }> = {
    3: { text: '3', emoji: '🎯', color: 'text-gold-bright' },
    2: { text: '2', emoji: '⚡', color: 'text-teal-bright' },
    1: { text: '1', emoji: '🔥', color: 'text-red-bright' },
  }

  if (count <= 0) return null

  const current = labels[count] ?? { text: String(count), emoji: '🎉', color: 'text-cream' }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060f17]">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          className="flex flex-col items-center gap-4"
        >
          <span className="text-6xl">{current.emoji}</span>
          <span className={`font-display text-8xl font-black ${current.color}`}>
            {current.text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

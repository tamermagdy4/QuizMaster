import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../utils/cn'

/**
 * The exact 8 outcomes of the Wheel of Fortune. The wheel NEVER picks anything
 * else — these values are the whole wheel.
 */
export const WHEEL_OUTCOMES = [-50, -100, -150, -200, 50, 100, 150, 200] as const

interface WheelSegment {
  value: number
  color: string
  labelColor: string
}

/**
 * Physical order of the slices on the wheel (clockwise). Positive slices use
 * the green/emerald family, negative slices the red/rose family, so the
 * outcome is readable at a glance.
 */
const SEGMENTS: WheelSegment[] = [
  { value: 50, color: '#468a5e', labelColor: '#ffffff' },
  { value: -50, color: '#b04d49', labelColor: '#ffffff' },
  { value: 100, color: '#3d7953', labelColor: '#ffffff' },
  { value: -100, color: '#9e433f', labelColor: '#ffffff' },
  { value: 150, color: '#356847', labelColor: '#ffffff' },
  { value: -150, color: '#8c3a37', labelColor: '#ffffff' },
  { value: 200, color: '#2c573c', labelColor: '#ffffff' },
  { value: -200, color: '#7a322f', labelColor: '#ffffff' },
]

const SEGMENT_ANGLE = 360 / SEGMENTS.length
const WHEEL_RADIUS = 120
const CENTER = 130
const SPIN_MS = 4200

/** Formats +100 as "+100" and -50 as "-50". */
function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`
}

interface WheelOfFortuneProps {
  open: boolean
  english?: boolean
  onResult: (points: number) => void
  onClose: () => void
}

/**
 * Big visible Wheel of Fortune shown in the center of the screen when the
 * player activates the wheel lifeline. The player presses [لف العجلة] to
 * spin; once the wheel stops, `onResult` is called with the landed outcome
 * (positive or negative) so the store can apply it to the score.
 *
 * Works identically in Local and Online: the store decides who the outcome
 * belongs to and syncs it; this component only renders and animates.
 */
export function WheelOfFortune({ open, english, onResult, onClose }: WheelOfFortuneProps) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)

  // Reset the wheel every time it opens (fresh spin, no leftover rotation).
  useEffect(() => {
    if (!open) {
      setRotation(0)
      setSpinning(false)
      setResult(null)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const handleSpin = () => {
    if (spinning) return
    setSpinning(true)
    setResult(null)

    // Pick a random outcome; the wheel must land with the pointer (top, -90°)
    // over the matching slice's center. Slice `idx` occupies angles
    // [idx*A - 90, (idx+1)*A - 90] (clockwise, y-down); its center is at
    // idx*A + A/2 - 90. After rotating the wheel by R (clockwise), the center
    // sits at idx*A + A/2 - 90 + R, which we want ≡ -90° (mod 360)
    // → R ≡ -idx*A - A/2 (mod 360).
    const idx = Math.floor(Math.random() * SEGMENTS.length)
    const jitter = Math.random() * 30 - 15
    const targetMod = (((-idx * SEGMENT_ANGLE - SEGMENT_ANGLE / 2 + jitter) % 360) + 360) % 360
    const currentMod = ((rotation % 360) + 360) % 360
    const delta = (targetMod - currentMod + 360) % 360
    const next = rotation + 360 * 5 + delta
    setRotation(next)

    timerRef.current = window.setTimeout(() => {
      setSpinning(false)
      setResult(SEGMENTS[idx].value)
      onResult(SEGMENTS[idx].value)
    }, SPIN_MS)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir={english ? 'ltr' : 'rtl'}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/88 p-4"
        >
          <motion.div
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16 }}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-gold/30 bg-[#0e1622]/95 p-5 text-center shadow-2xl shadow-black/60"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={spinning}
              aria-label={english ? 'Close' : 'إغلاق'}
              className="absolute top-3 end-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-black text-slate-400 transition hover:border-red/40 hover:text-red-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✕
            </button>
            <p className="text-3xl" aria-hidden>🎡</p>
            <h2 className="mt-1 text-xl font-black text-[#e4c478]">
              {english ? 'Wheel of Fortune' : 'عجلة الحظ'}
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {english ? 'Spin the wheel — win points, or lose some!' : 'دُر العجلة — اربح نقاطًا، أو اخسر بعضها!'}
            </p>

            {/* Wheel + fixed pointer. Width scales down on small / landscape
                screens via min() so nothing escapes the modal. */}
            <div
              className="relative mx-auto mt-5 aspect-square"
              style={{ width: 'min(72vw, 19rem, 40vh)' }}
            >
              {/* Fixed pointer at the top of the wheel — tip points DOWN at
                  the winning slice and never moves while the wheel spins. */}
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]">
                <svg width="38" height="46" viewBox="0 0 38 46" aria-hidden>
                  <defs>
                    <linearGradient id="wheelArrowGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e4c478" />
                      <stop offset="100%" stopColor="#c69c46" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M19 45 L32 8 L19 16 L6 8 Z"
                    fill="url(#wheelArrowGold)"
                    stroke="#7a5818"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Rotating wheel — subtle landing bounce once the spin stops */}
              <motion.div
                className="h-full w-full"
                animate={result !== null ? { scale: [1, 1.035, 1] } : undefined}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.06 }}
              >
              <div
                className="h-full w-full"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.15, 1)`
                    : 'transform 0.3s ease',
                }}
              >
                <svg viewBox="0 0 260 260" className="h-full w-full drop-shadow-2xl" aria-hidden>
                  {/* Outer gold rim */}
                  <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 5} fill="#c69c46" />
                  <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 5} fill="none" stroke="#7a5818" strokeWidth="2" />

                  {SEGMENTS.map((segment, idx) => {
                    const startAngle = idx * SEGMENT_ANGLE - 90
                    const endAngle = startAngle + SEGMENT_ANGLE
                    const startRad = (startAngle * Math.PI) / 180
                    const endRad = (endAngle * Math.PI) / 180
                    const x1 = CENTER + WHEEL_RADIUS * Math.cos(startRad)
                    const y1 = CENTER + WHEEL_RADIUS * Math.sin(startRad)
                    const x2 = CENTER + WHEEL_RADIUS * Math.cos(endRad)
                    const y2 = CENTER + WHEEL_RADIUS * Math.sin(endRad)
                    const midAngle = (startAngle + endAngle) / 2
                    const midRad = (midAngle * Math.PI) / 180
                    const lx = CENTER + WHEEL_RADIUS * 0.6 * Math.cos(midRad)
                    const ly = CENTER + WHEEL_RADIUS * 0.6 * Math.sin(midRad)
                    // Small gold bead at each slice boundary on the rim.
                    const bx = CENTER + (WHEEL_RADIUS + 5) * Math.cos(startRad)
                    const by = CENTER + (WHEEL_RADIUS + 5) * Math.sin(startRad)
                    return (
                      <g key={segment.value}>
                        <path
                          d={`M ${CENTER} ${CENTER} L ${x1} ${y1} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${x2} ${y2} Z`}
                          fill={segment.color}
                          stroke="#0e1622"
                          strokeWidth="3"
                        />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={segment.labelColor}
                          fontSize="19"
                          fontWeight="900"
                          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: '3px' }}
                        >
                          {formatPoints(segment.value)}
                        </text>
                        <circle cx={bx} cy={by} r="2.4" fill="#e4c478" />
                      </g>
                    )
                  })}

                  {/* Center hub */}
                  <circle cx={CENTER} cy={CENTER} r="24" fill="#0e1622" stroke="#c69c46" strokeWidth="3" />
                  <circle cx={CENTER} cy={CENTER} r="18" fill="#182230" stroke="#e4c478" strokeWidth="1" />
                  <text
                    x={CENTER}
                    y={CENTER}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#e4c478"
                    fontSize="16"
                    fontWeight="900"
                  >
                    {spinning ? '…' : result === null ? '؟' : formatPoints(result)}
                  </text>
                </svg>
              </div>
              </motion.div>
            </div>

            {/* Spin / result area */}
            <div className="mt-5 min-h-[72px]">
              {result === null ? (
                <>
                  <button
                    type="button"
                    onClick={handleSpin}
                    disabled={spinning}
                    className={cn(
                      'w-full rounded-xl px-4 py-3 text-sm font-black transition',
                      spinning
                        ? 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500'
                        : 'bg-gradient-to-r from-[#d4a84f] to-[#c69c46] text-[#0e1622] shadow-lg shadow-[#c69c46]/20 hover:-translate-y-0.5',
                    )}
                  >
                    {spinning
                      ? english ? 'Spinning…' : 'جارٍ الدوران…'
                      : english ? '🎰 Spin the wheel' : 'لف العجلة'}
                  </button>
                  {spinning && (
                    <p className="mt-2 text-[11px] font-bold text-[#e4c478]/70">
                      {english ? 'Good luck!' : 'بالتوفيق!'}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      'inline-flex items-baseline gap-2 rounded-full px-6 py-2 ring-1',
                      result > 0
                        ? 'bg-green/15 text-green-bright ring-green/40'
                        : 'bg-red/15 text-red-bright ring-red/40',
                    )}
                  >
                    <span className="text-4xl font-black">{formatPoints(result)}</span>
                    <span className="text-base font-bold text-slate-300">
                      {english ? 'points' : 'نقطة'}
                    </span>
                  </motion.div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl bg-[#4d79a7] hover:bg-[#5b87b5] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#4d79a7]/25 transition hover:-translate-y-0.5"
                  >
                    {english ? 'Done' : 'تم'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

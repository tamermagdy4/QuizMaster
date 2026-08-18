import { motion } from 'framer-motion'
import { MIN_PLAYERS, MAX_PLAYERS } from '../../types/game'
import { cn } from '../../utils/cn'

interface PlayerCounterProps {
  label: string
  value: number
  onDecrease: () => void
  onIncrease: () => void
}

export function PlayerCounter({ label, value, onDecrease, onIncrease }: PlayerCounterProps) {
  const atMin = value <= MIN_PLAYERS
  const atMax = value >= MAX_PLAYERS

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-cream/70">{label}</p>
      <div className="flex items-center gap-3">
        <CounterButton
          label="تقليل"
          disabled={atMin}
          onClick={onDecrease}
        >
          −
        </CounterButton>

        <motion.span
          key={value}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="score-number min-w-10 text-center text-xl font-black text-gold-bright"
        >
          {value}
        </motion.span>

        <CounterButton
          label="زيادة"
          disabled={atMax}
          onClick={onIncrease}
        >
          +
        </CounterButton>
      </div>
    </div>
  )
}

interface CounterButtonProps {
  children: string
  label: string
  disabled: boolean
  onClick: () => void
}

function CounterButton({ children, label, disabled, onClick }: CounterButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg font-black transition',
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/5 text-cream/30'
          : 'border-[#20616C] bg-gradient-to-b from-[#20616C] to-[#123B46] text-white shadow-[0_6px_16px_rgba(18,59,70,0.4)]',
      )}
    >
      {children}
    </motion.button>
  )
}

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
      <p className="text-sm font-medium text-white/80">{label}</p>
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
          className="min-w-10 text-center text-xl font-bold text-gold-400"
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
        'flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-bold transition',
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/25'
          : 'glass-button border-white/25 text-white hover:border-gold-400/40',
      )}
    >
      {children}
    </motion.button>
  )
}

import { motion } from 'framer-motion'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { HelpMenu } from './HelpMenu'
import type { FfaPlayerState, Lifeline } from '../../types/board'
import type { TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface GameBoardHeaderProps {
  isFfa: boolean
  ffaPlayers: FfaPlayerState[]
  ffaTurnPlayerId: string | null
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  currentTurn: TeamId
  gameName: string
  questionDuration: number
  countdown: number
  hasActiveQuestion: boolean
  soundEnabled: boolean
  onToggleSound: () => void
  onSwitchTurn: () => void
  direction: 'rtl' | 'ltr'
  /** Lifelines for the help menu (the current team/question's deck). */
  lifelines: Lifeline[]
  getLifelineDisabled?: (lifelineId: string) => boolean
  activeLifelineId?: string | null
  onUseLifeline?: (lifelineId: string) => void
}

const teamTone = {
  1: {
    chip: 'bg-[#3b82f6]/15 text-[#93c5fd]',
    name: 'text-[#93c5fd]',
    icon: '🛡️',
    ring: 'border-[#3b82f6]/40',
    glow: 'shadow-[0_0_22px_rgba(59,130,246,0.3)]',
  },
  2: {
    chip: 'bg-[#ef4444]/15 text-[#fca5a5]',
    name: 'text-[#fca5a5]',
    icon: '👑',
    ring: 'border-[#ef4444]/40',
    glow: 'shadow-[0_0_22px_rgba(239,68,68,0.3)]',
  },
} as const

/**
 * The game-show header.
 *
 *  ┌───────────────┬────────────────┬──────────────┐
 *  │ teams + score │  فهلوي identity │ turn + help  │
 *  └───────────────┴────────────────┴──────────────┘
 *
 * RTL-aware: the three zones use logical order, so on an Arabic board the
 * teams land on the right and the turn/help zone on the left.
 */
export function GameBoardHeader({
  isFfa,
  ffaPlayers,
  ffaTurnPlayerId,
  team1Name,
  team2Name,
  team1Score,
  team2Score,
  currentTurn,
  gameName,
  questionDuration,
  countdown,
  hasActiveQuestion,
  soundEnabled,
  onToggleSound,
  onSwitchTurn,
  direction,
  lifelines,
  getLifelineDisabled,
  activeLifelineId,
  onUseLifeline,
}: GameBoardHeaderProps) {
  const english = direction === 'ltr'
  const lowTime = hasActiveQuestion && countdown <= 5
  const turnName = currentTurn === 1 ? team1Name : team2Name

  return (
    <div className="relative z-30 rounded-2xl border border-petro-line-strong bg-gradient-to-b from-[#0e2030]/95 to-[#0a1823] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(0,0,0,0.35)]">
      {/* Arena floor glow (rounded itself so the header needs no overflow clip) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(60%_120%_at_50%_0%,rgba(47,125,126,0.14),transparent_60%)]" />

      <div className="relative flex flex-wrap items-center gap-x-1.5 gap-y-1.5 px-2 py-1.5 sm:flex-nowrap sm:gap-3 sm:px-3 sm:py-2 lg:px-4 lg:py-2.5">
        {/* ===== LEFT: teams + scores ===== */}
        <div className="order-1 flex min-w-0 w-full flex-none items-center gap-1.5 sm:order-none sm:w-auto sm:flex-1 lg:gap-2">
          {isFfa ? (
            <div className="flex flex-1 flex-wrap items-center justify-start gap-1.5 lg:gap-2">
              {ffaPlayers.map((player, index) => {
                const isActive = ffaTurnPlayerId === player.playerId
                const tones = index % 2 === 0 ? teamTone[1] : teamTone[2]
                return (
                  <div
                    key={player.playerId}
                    className={cn(
                      'relative flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 transition-all duration-300',
                      isActive
                        ? cn('border-gold/60 bg-gradient-to-b from-[#123047] to-[#0c1d2e]', tones.glow)
                        : cn(tones.ring, 'bg-gradient-to-b from-[#0e2030] to-[#0a1823]'),
                    )}
                  >
                    {isActive && (
                      <span className="absolute -top-1.5 start-1 rounded bg-gold px-1 py-[1px] text-[6px] font-black text-[#1d1603]">
                        {english ? '● TURN' : '🎯 الدور'}
                      </span>
                    )}
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px]', isActive ? 'bg-gold/15' : tones.chip)} aria-hidden>
                      {tones.icon}
                    </span>
                    <div className="flex min-w-0 flex-col leading-none">
                      <span className={cn('max-w-[70px] truncate text-[9px] font-bold', isActive ? 'text-gold-bright' : tones.name)}>
                        {player.name}
                      </span>
                      <AnimatedNumber value={player.score} className={cn('score-number text-sm', isActive ? 'text-gold-bright' : 'text-cream')} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              <TeamChip
                id={1}
                name={team1Name}
                score={team1Score}
                isActive={currentTurn === 1}
              />
              <TeamChip
                id={2}
                name={team2Name}
                score={team2Score}
                isActive={currentTurn === 2}
              />
            </>
          )}
        </div>

        {/* ===== CENTER: فهلوي identity + countdown ===== */}
        <div className="order-2 flex min-w-0 grow items-center justify-center gap-2 px-1 sm:order-none sm:grow-0 sm:shrink-0 sm:flex-col sm:justify-start sm:px-1">
          <div className="flex min-w-0 flex-col items-center leading-none">
            <span className="font-display text-sm font-black tracking-wide text-[#F5D98B] drop-shadow-[0_2px_8px_rgba(212,168,67,0.35)] sm:text-base lg:text-lg">
              فهلوي
            </span>
            <span className="mt-0.5 max-w-[110px] truncate text-[9px] font-bold text-cream/55 lg:max-w-[160px] lg:text-[10px]">
              {gameName}
            </span>
          </div>

          {/* Countdown — the shared question timer */}
          <motion.div
            key={countdown}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: lowTime ? [1, 1.15, 1] : 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black tabular-nums transition-colors duration-300 sm:mt-1 lg:h-9 lg:w-9 lg:text-sm',
              lowTime
                ? 'border-[#ef4444] bg-[#ef4444]/12 text-[#fca5a5] shadow-[0_0_18px_rgba(239,68,68,0.4)]'
                : hasActiveQuestion
                  ? 'border-[#D4A843]/60 bg-[#D4A843]/12 text-[#F5D98B]'
                  : 'border-petro-line bg-[#0f172a] text-gray-400',
            )}
          >
            {hasActiveQuestion ? countdown.toString().padStart(2, '0') : questionDuration.toString()}
          </motion.div>
        </div>

        {/* ===== RIGHT: turn badge + controls + help ===== */}
        <div className="order-3 flex min-w-0 flex-none items-center justify-end gap-1.5 sm:order-none sm:flex-1 lg:gap-2">
          {/* Current turn badge */}
          <div
            className={cn(
              'hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 sm:flex',
              currentTurn === 1
                ? 'border-[#3b82f6]/45 bg-[#3b82f6]/10'
                : 'border-[#ef4444]/45 bg-[#ef4444]/10',
            )}
          >
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg text-xs', currentTurn === 1 ? 'bg-[#3b82f6]/20 text-[#93c5fd]' : 'bg-[#ef4444]/20 text-[#fca5a5]')} aria-hidden>
              🎯
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[8px] font-black text-cream/50">{english ? 'TURN' : 'الدور الحالي'}</span>
              <span className={cn('mt-0.5 max-w-[90px] truncate text-[11px] font-black', currentTurn === 1 ? 'text-[#93c5fd]' : 'text-[#fca5a5]')}>
                {turnName}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            title={english ? 'Sound' : 'الصوت'}
            aria-label={english ? 'Sound' : 'الصوت'}
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-petro-line bg-[#0f172a] text-sm text-gray-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:text-teal-bright hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-95 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            onClick={onSwitchTurn}
            title={english ? 'Switch turn' : 'تبديل الدور'}
            aria-label={english ? 'Switch turn' : 'تبديل الدور'}
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-petro-line bg-[#0f172a] text-sm text-gray-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:text-gold-bright hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-95 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
          >
            ⇄
          </button>

          <HelpMenu
            lifelines={lifelines}
            accent={currentTurn === 1 ? 'royal' : 'gold'}
            getDisabled={getLifelineDisabled}
            activeLifelineId={activeLifelineId}
            onSelect={onUseLifeline}
            english={english}
          />
        </div>
      </div>
    </div>
  )
}

function TeamChip({
  id,
  name,
  score,
  isActive,
}: {
  id: TeamId
  name: string
  score: number
  isActive: boolean
}) {
  const tone = teamTone[id]
  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.6, times: [0, 0.5, 1], ease: 'easeOut' }}
      className={cn(
        'relative flex min-w-0 flex-1 items-center gap-1 rounded-xl border px-1.5 py-1 transition-all duration-300 sm:gap-1.5 sm:px-2 sm:py-1.5 lg:gap-2 lg:px-3',
        isActive
          ? cn('border-gold/60 bg-gradient-to-b from-[#123047] to-[#0c1d2e]', tone.glow)
          : cn(tone.ring, 'bg-gradient-to-b from-[#0e2030] to-[#0a1823]'),
      )}
    >
      {isActive && (
        <motion.span
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-2 start-2 rounded-full bg-gold px-1.5 py-[1px] text-[7px] font-black text-[#1d1603] shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
        >
          🎯 الدور
        </motion.span>
      )}
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs sm:h-7 sm:w-7 lg:h-9 lg:w-9 lg:text-base', isActive ? 'bg-gold/15' : tone.chip)} aria-hidden>
        {tone.icon}
      </span>
      <div className="flex min-w-0 flex-col leading-none">
        <span className={cn('font-display max-w-[80px] truncate text-[10px] font-bold sm:max-w-[90px] sm:text-[11px] lg:max-w-[120px] lg:text-xs', isActive ? 'text-gold-bright' : tone.name)}>
          {name}
        </span>
        <AnimatedNumber value={score} className={cn('score-number mt-0.5 text-lg sm:text-xl lg:text-2xl', isActive ? 'text-gold-bright' : tone.name)} />
      </div>
    </motion.div>
  )
}

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
 * RTL-aware: uses logical properties throughout so teams land on the
 * correct side in both Arabic (RTL) and English (LTR).
 *
 * Mobile-first responsive design: works on 360px → 412px → desktop.
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
    <div className="relative z-30 overflow-hidden rounded-xl border border-petro-line-strong bg-gradient-to-b from-[#0e2030]/95 to-[#0a1823] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(0,0,0,0.35)] sm:rounded-2xl">
      {/* Arena floor glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(60%_120%_at_50%_0%,rgba(47,125,126,0.14),transparent_60%)]" />

      {/* Row 1: Teams + Identity + Timer + Controls */}
      <div className="relative flex items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3 sm:py-2 lg:gap-3 lg:px-4 lg:py-2.5">
        {/* Teams + scores */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5 lg:gap-2">
          {isFfa ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:gap-1.5">
              {ffaPlayers.map((player, index) => {
                const isActive = ffaTurnPlayerId === player.playerId
                const tones = index % 2 === 0 ? teamTone[1] : teamTone[2]
                return (
                  <div
                    key={player.playerId}
                    className={cn(
                      'relative flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 transition-all duration-300 sm:rounded-lg sm:px-2 sm:py-1',
                      isActive
                        ? cn('border-gold/60 bg-gradient-to-b from-[#123047] to-[#0c1d2e]', tones.glow)
                        : cn(tones.ring, 'bg-gradient-to-b from-[#0e2030] to-[#0a1823]'),
                    )}
                  >
                    {isActive && (
                      <span className="absolute -top-1.5 start-1 rounded bg-gold px-1 py-[1px] text-[5px] font-black text-[#1d1603] sm:text-[6px]">
                        {english ? '● TURN' : '🎯 الدور'}
                      </span>
                    )}
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] sm:h-5 sm:w-5 sm:rounded-md sm:text-[10px]', isActive ? 'bg-gold/15' : tones.chip)} aria-hidden>
                      {tones.icon}
                    </span>
                    <div className="flex min-w-0 flex-col leading-none">
                      <span className={cn('max-w-[50px] truncate text-[7px] font-bold sm:max-w-[70px] sm:text-[9px]', isActive ? 'text-gold-bright' : tones.name)}>
                        {player.name}
                      </span>
                      <AnimatedNumber value={player.score} className={cn('score-number text-[10px] sm:text-sm', isActive ? 'text-gold-bright' : 'text-cream')} />
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

        {/* Center: فهلوي identity + countdown */}
        <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:items-center sm:gap-0.5">
          <div className="flex min-w-0 flex-col items-center leading-none">
            <span className="font-display text-[11px] font-black tracking-wide text-[#F5D98B] drop-shadow-[0_2px_8px_rgba(212,168,67,0.35)] sm:text-sm lg:text-lg">
              فهلوي
            </span>
            <span className="mt-0.5 max-w-[60px] truncate text-[7px] font-bold text-cream/55 sm:max-w-[110px] sm:text-[9px] lg:max-w-[160px] lg:text-[10px]">
              {gameName}
            </span>
          </div>

          {/* Countdown timer */}
          <motion.div
            key={countdown}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: lowTime ? [1, 1.15, 1] : 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black tabular-nums transition-colors duration-300 sm:h-8 sm:w-8 sm:text-xs lg:h-9 lg:w-9 lg:text-sm',
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

        {/* Right: turn badge + controls + help */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:gap-2">
          {/* Current turn badge — hidden on very small screens */}
          <div
            className={cn(
              'hidden items-center gap-1 rounded-lg border px-1.5 py-1 sm:flex sm:gap-1.5 sm:px-2.5 sm:py-1.5',
              currentTurn === 1
                ? 'border-[#3b82f6]/45 bg-[#3b82f6]/10'
                : 'border-[#ef4444]/45 bg-[#ef4444]/10',
            )}
          >
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-md text-[10px] sm:h-6 sm:w-6 sm:text-xs', currentTurn === 1 ? 'bg-[#3b82f6]/20 text-[#93c5fd]' : 'bg-[#ef4444]/20 text-[#fca5a5]')} aria-hidden>
              🎯
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[7px] font-black text-cream/50 sm:text-[8px]">{english ? 'TURN' : 'الدور الحالي'}</span>
              <span className={cn('mt-0.5 max-w-[70px] truncate text-[9px] font-black sm:max-w-[90px] sm:text-[11px]', currentTurn === 1 ? 'text-[#93c5fd]' : 'text-[#fca5a5]')}>
                {turnName}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            title={english ? 'Sound' : 'الصوت'}
            aria-label={english ? 'Sound' : 'الصوت'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-petro-line bg-[#0f172a] text-xs text-gray-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:text-teal-bright active:translate-y-0 active:scale-95 sm:h-8 sm:w-8 sm:text-sm lg:h-10 lg:w-10"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            onClick={onSwitchTurn}
            title={english ? 'Switch turn' : 'تبديل الدور'}
            aria-label={english ? 'Switch turn' : 'تبديل الدور'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-petro-line bg-[#0f172a] text-xs text-gray-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:text-gold-bright active:translate-y-0 active:scale-95 sm:h-8 sm:w-8 sm:text-sm lg:h-10 lg:w-10"
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

      {/* Row 2 (mobile only): Turn badge — shown below on very small screens */}
      <div className="flex items-center justify-center border-t border-white/5 px-2 py-0.5 sm:hidden">
        <div
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-0.5',
            currentTurn === 1
              ? 'border-[#3b82f6]/30 bg-[#3b82f6]/8'
              : 'border-[#ef4444]/30 bg-[#ef4444]/8',
          )}
        >
          <span className="text-[9px]" aria-hidden>🎯</span>
          <span className="text-[7px] font-bold text-cream/50">{english ? 'TURN' : 'الدور'}</span>
          <span className={cn('text-[8px] font-black', currentTurn === 1 ? 'text-[#93c5fd]' : 'text-[#fca5a5]')}>
            {turnName}
          </span>
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
        'relative flex min-w-0 flex-1 items-center gap-0.5 rounded-lg border px-1 py-0.5 transition-all duration-300 sm:gap-1 sm:rounded-xl sm:px-1.5 sm:py-1 lg:gap-2 lg:px-3',
        isActive
          ? cn('border-gold/60 bg-gradient-to-b from-[#123047] to-[#0c1d2e]', tone.glow)
          : cn(tone.ring, 'bg-gradient-to-b from-[#0e2030] to-[#0a1823]'),
      )}
    >
      {isActive && (
        <motion.span
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-2 start-1 rounded-full bg-gold px-1 py-[1px] text-[5px] font-black text-[#1d1603] shadow-[0_4px_10px_rgba(0,0,0,0.45)] sm:start-2 sm:px-1.5 sm:text-[7px]"
        >
          🎯 الدور
        </motion.span>
      )}
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] sm:h-6 sm:w-6 sm:text-xs lg:h-9 lg:w-9 lg:text-base', isActive ? 'bg-gold/15' : tone.chip)} aria-hidden>
        {tone.icon}
      </span>
      <div className="flex min-w-0 flex-col leading-none">
        <span className={cn('font-display max-w-[50px] truncate text-[8px] font-bold sm:max-w-[80px] sm:text-[10px] lg:max-w-[120px] lg:text-xs', isActive ? 'text-gold-bright' : tone.name)}>
          {name}
        </span>
        <AnimatedNumber value={score} className={cn('score-number mt-0.5 text-xs sm:text-lg lg:text-2xl', isActive ? 'text-gold-bright' : tone.name)} />
      </div>
    </motion.div>
  )
}

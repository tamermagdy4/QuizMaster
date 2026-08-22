import { motion } from 'framer-motion'
import { Crown, Shield, Volume2, VolumeX, ArrowLeftRight } from 'lucide-react'
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

const teamColor = {
  1: { accent: '#4d79a7', text: '#8eaecf', bg: 'rgba(77,121,167,0.15)' },
  2: { accent: '#b04d49', text: '#d48c88', bg: 'rgba(176,77,73,0.15)' },
} as const

/**
 * Professional game-show HUD.
 *
 * RTL-aware via logical properties.
 * Mobile-first responsive: 360px → 412px → desktop.
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
  const t1 = teamColor[1]
  const t2 = teamColor[2]

  return (
    <div className="relative z-30 overflow-visible">
      {/* ─── Main scoreboard bar ─── */}
      <div
        className="relative flex items-stretch rounded-xl border border-white/10 bg-[#0d1420]/95 sm:rounded-2xl"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.45)' }}
      >
        {/* Active team accent — thin top line */}
        <motion.div
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[inherit]"
          animate={{
            background:
              currentTurn === 1
                ? `linear-gradient(90deg, transparent 0%, ${t1.accent} 30%, ${t1.accent} 70%, transparent 100%)`
                : `linear-gradient(90deg, transparent 0%, ${t2.accent} 30%, ${t2.accent} 70%, transparent 100%)`,
            opacity: hasActiveQuestion ? 0.9 : 0.3,
          }}
          transition={{ duration: 0.4 }}
        />

        {/* ─── TEAM 1 ─── */}
        <div className="flex flex-1 items-center gap-1.5 px-2 py-1.5 sm:px-4 sm:py-2">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded sm:h-6 sm:w-6"
            style={{ color: t1.text, background: t1.bg }}
          >
            <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="flex min-w-0 flex-col leading-none">
            <span
              className={cn(
                'max-w-[60px] truncate text-[8px] font-bold sm:max-w-[90px] sm:text-[10px] lg:max-w-[140px] lg:text-xs',
                currentTurn === 1 ? 'text-white' : 'text-white/40',
              )}
            >
              {team1Name}
            </span>
            <AnimatedNumber
              value={team1Score}
              className={cn(
                'score-number tabular-nums text-base font-black sm:text-2xl lg:text-3xl',
                currentTurn === 1 ? 'text-white' : 'text-white/35',
              )}
            />
          </div>
        </div>

        {/* ─── CENTER: timer + game identity ─── */}
        <div className="flex shrink-0 flex-col items-center justify-center px-2 sm:px-6">
          {/* Timer */}
          <motion.div
            key={countdown}
            initial={lowTime ? { scale: 1.1 } : false}
            animate={{ scale: lowTime ? [1, 1.12, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full tabular-nums sm:h-10 sm:w-10 lg:h-11 lg:w-11',
              lowTime
                ? 'bg-[#b04d49]/20 text-[#d48c88]'
                : hasActiveQuestion
                  ? 'bg-[#c69c46]/15 text-[#e4c478]'
                  : 'bg-white/5 text-white/30',
            )}
          >
            <span className="text-sm font-black sm:text-lg lg:text-xl">
              {hasActiveQuestion ? countdown.toString().padStart(2, '0') : questionDuration.toString().padStart(2, '0')}
            </span>
          </motion.div>

          {/* Game name — small, below timer */}
          <span className="mt-0.5 max-w-[50px] truncate text-[6px] font-bold text-white/25 sm:max-w-[80px] sm:text-[8px] lg:max-w-[120px] lg:text-[9px]">
            {gameName}
          </span>
        </div>

        {/* ─── TEAM 2 ─── */}
        <div className="flex flex-1 items-center justify-end gap-1.5 px-2 py-1.5 sm:px-4 sm:py-2">
          <div className="flex min-w-0 flex-col items-end leading-none">
            <span
              className={cn(
                'max-w-[60px] truncate text-[8px] font-bold sm:max-w-[90px] sm:text-[10px] lg:max-w-[140px] lg:text-xs',
                currentTurn === 2 ? 'text-white' : 'text-white/40',
              )}
            >
              {team2Name}
            </span>
            <AnimatedNumber
              value={team2Score}
              className={cn(
                'score-number tabular-nums text-base font-black sm:text-2xl lg:text-3xl',
                currentTurn === 2 ? 'text-white' : 'text-white/35',
              )}
            />
          </div>
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded sm:h-6 sm:w-6"
            style={{ color: t2.text, background: t2.bg }}
          >
            <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
        </div>
      </div>

      {/* ─── Controls row ─── */}
      <div className="mt-1 flex items-center justify-center gap-1 px-1 sm:mt-1.5 sm:gap-2">
        {/* Active turn indicator — compact pill */}
        <div
          className={cn(
            'hidden items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold sm:flex sm:px-2.5 sm:text-[10px]',
            currentTurn === 1
              ? 'bg-[#4d79a7]/10 text-[#8eaecf]'
              : 'bg-[#b04d49]/10 text-[#d48c88]',
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: currentTurn === 1 ? t1.accent : t2.accent }} />
          {english ? 'TURN' : 'الدور'}
          <span className="opacity-60">·</span>
          <span className="max-w-[60px] truncate lg:max-w-[100px]">{turnName}</span>
        </div>

        <div className="h-3 w-px bg-white/10 sm:hidden" />

        {/* Lifelines */}
        <HelpMenu
          lifelines={lifelines}
          accent={currentTurn === 1 ? 'royal' : 'gold'}
          getDisabled={getLifelineDisabled}
          activeLifelineId={activeLifelineId}
          onSelect={onUseLifeline}
          english={english}
        />

        {/* Sound */}
        <button
          type="button"
          onClick={onToggleSound}
          title={english ? 'Sound' : 'الصوت'}
          aria-label={english ? 'Sound' : 'الصوت'}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 active:text-white/50 sm:h-8 sm:w-8"
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        </button>

        {/* Switch turn */}
        <button
          type="button"
          onClick={onSwitchTurn}
          title={english ? 'Switch turn' : 'تبديل الدور'}
          aria-label={english ? 'Switch turn' : 'تبديل الدور'}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 active:text-white/50 sm:h-8 sm:w-8"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        {/* Mobile turn pill */}
        <div
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-[8px] font-bold sm:hidden',
            currentTurn === 1
              ? 'bg-[#4d79a7]/10 text-[#8eaecf]'
              : 'bg-[#b04d49]/10 text-[#d48c88]',
          )}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: currentTurn === 1 ? t1.accent : t2.accent }} />
          <span className="max-w-[40px] truncate">{turnName}</span>
        </div>
      </div>

      {/* ─── FFA player chips (3+ players online) ─── */}
      {isFfa && (
        <div className="mt-1 flex items-center justify-center gap-1 overflow-x-auto px-2 sm:gap-1.5">
          {ffaPlayers.map((player, index) => {
            const isActive = ffaTurnPlayerId === player.playerId
            const tone = index % 2 === 0 ? t1 : t2
            return (
              <div
                key={player.playerId}
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px]',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'bg-white/[0.03] text-white/35',
                )}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ background: isActive ? '#c69c46' : tone.accent, opacity: isActive ? 1 : 0.5 }}
                />
                <span className="max-w-[40px] truncate font-bold sm:max-w-[60px]">{player.name}</span>
                <AnimatedNumber
                  value={player.score}
                  className={cn('score-number tabular-nums font-black', isActive ? 'text-white' : 'text-white/25')}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

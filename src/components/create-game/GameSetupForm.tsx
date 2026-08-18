import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { GlassInput } from '../ui/GlassInput'
import { PlayerCounter } from './PlayerCounter'
import { TeamSelectionProgress } from './TeamSelectionProgress'
import type { TeamId } from '../../types/game'
import { cn } from '../../utils/cn'
import { useTranslation } from '../../i18n/translations'

interface GameSetupFormProps {
  className?: string
  gameName: string
  team1Name: string
  team2Name: string
  team1Players: number
  team2Players: number
  team1Count: number
  team2Count: number
  activeTeam: TeamId
  canStart: boolean
  onGameNameChange: (value: string) => void
  onTeam1NameChange: (value: string) => void
  onTeam2NameChange: (value: string) => void
  onTeam1PlayersDecrease: () => void
  onTeam1PlayersIncrease: () => void
  onTeam2PlayersDecrease: () => void
  onTeam2PlayersIncrease: () => void
  onStartGame: () => void
  children?: ReactNode
}

export function GameSetupForm({
  className, gameName, team1Name, team2Name, team1Players, team2Players, team1Count, team2Count,
  activeTeam, canStart, onGameNameChange, onTeam1NameChange, onTeam2NameChange,
  onTeam1PlayersDecrease, onTeam1PlayersIncrease, onTeam2PlayersDecrease, onTeam2PlayersIncrease,
  onStartGame, children,
}: GameSetupFormProps) {
  const { english, t } = useTranslation()
  return (
    <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={cn('glass-dark flex h-fit flex-col gap-4 p-4 lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:overflow-hidden lg:p-5', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3"><div><p className="eyebrow">{t('arena')}</p><h2 className="font-display mt-1 text-xl font-extrabold text-cream">{t('teamSetup')}</h2></div><span className="text-2xl text-teal-bright" aria-hidden>♟</span></div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pe-1 overscroll-contain">
        <GlassInput dark label={t('gameName')} placeholder={english ? 'Example: Family quiz' : 'مثال: مسابقة العائلة'} value={gameName} onChange={(event) => onGameNameChange(event.target.value)} />
        <div className="dark-card p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-teal-bright">{t('teamOne')}</h3><span className="text-lg text-teal-bright" aria-hidden>♟</span></div><GlassInput dark label={t('teamOneName')} placeholder={english ? 'Team 1 name' : 'اسم الفريق الأول'} value={team1Name} onChange={(event) => onTeam1NameChange(event.target.value)} /><div className="mt-3"><PlayerCounter label={t('playersOne')} value={team1Players} onDecrease={onTeam1PlayersDecrease} onIncrease={onTeam1PlayersIncrease} /></div></div>
        <div className="dark-card p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-gold-bright">{t('teamTwo')}</h3><span className="text-lg text-gold-bright" aria-hidden>♟</span></div><GlassInput dark label={t('teamTwoName')} placeholder={english ? 'Team 2 name' : 'اسم الفريق الثاني'} value={team2Name} onChange={(event) => onTeam2NameChange(event.target.value)} /><div className="mt-3"><PlayerCounter label={t('playersTwo')} value={team2Players} onDecrease={onTeam2PlayersDecrease} onIncrease={onTeam2PlayersIncrease} /></div></div>
        <div className="dark-card p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-cream">{t('selectionSummary')}</h3><span className="text-teal-bright" aria-hidden>▣</span></div><TeamSelectionProgress team1Name={team1Name || t('teamOne')} team2Name={team2Name || t('teamTwo')} team1Count={team1Count} team2Count={team2Count} activeTeam={activeTeam} /></div>
        {children && <details className="dark-card p-3.5" open><summary className="cursor-pointer list-none text-sm font-black text-cream">{t('lifelines')}</summary><div className="mt-4 space-y-4">{children}</div></details>}
      </div>
      <div className="shrink-0 border-t border-white/10 pt-3">
        <motion.button type="button" disabled={!canStart} whileTap={canStart ? { scale: .985 } : undefined} onClick={onStartGame} className={cn('w-full rounded-xl px-4 py-3 text-sm font-black transition', canStart ? 'btn btn-gold' : 'cursor-not-allowed border border-white/15 bg-white/5 text-cream/45')}>{canStart ? `${t('next')} →` : t('chooseRequirements')}</motion.button>
      </div>
    </motion.aside>
  )
}

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
    <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={cn('flex h-fit flex-col gap-4 rounded-[18px] border border-cyan-300/15 bg-[#081a34]/95 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl lg:sticky lg:top-24', className)}>
      <div className="flex items-center justify-between border-b border-white/10 pb-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">{t('arena')}</p><h2 className="mt-1 text-xl font-black text-white">{t('teamSetup')}</h2></div><span className="text-2xl text-cyan-300" aria-hidden>♟</span></div>
      <GlassInput label={t('gameName')} placeholder={english ? 'Example: Family quiz' : 'مثال: مسابقة العائلة'} value={gameName} onChange={(event) => onGameNameChange(event.target.value)} />
      <div className="rounded-2xl border border-cyan-300/15 bg-[#0b2344]/70 p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-cyan-100">{t('teamOne')}</h3><span className="text-lg text-cyan-300" aria-hidden>♟</span></div><GlassInput label={t('teamOneName')} placeholder={english ? 'Team 1 name' : 'اسم الفريق الأول'} value={team1Name} onChange={(event) => onTeam1NameChange(event.target.value)} /><div className="mt-3"><PlayerCounter label={t('playersOne')} value={team1Players} onDecrease={onTeam1PlayersDecrease} onIncrease={onTeam1PlayersIncrease} /></div></div>
      <div className="rounded-2xl border border-purple-300/15 bg-[#18183c]/70 p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-purple-100">{t('teamTwo')}</h3><span className="text-lg text-purple-300" aria-hidden>♟</span></div><GlassInput label={t('teamTwoName')} placeholder={english ? 'Team 2 name' : 'اسم الفريق الثاني'} value={team2Name} onChange={(event) => onTeam2NameChange(event.target.value)} /><div className="mt-3"><PlayerCounter label={t('playersTwo')} value={team2Players} onDecrease={onTeam2PlayersDecrease} onIncrease={onTeam2PlayersIncrease} /></div></div>
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3.5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-white">{t('selectionSummary')}</h3><span className="text-cyan-300" aria-hidden>▣</span></div><TeamSelectionProgress team1Name={team1Name || t('teamOne')} team2Name={team2Name || t('teamTwo')} team1Count={team1Count} team2Count={team2Count} activeTeam={activeTeam} /></div>
      {children && <details className="rounded-2xl border border-white/10 bg-white/[.03] p-3.5" open><summary className="cursor-pointer list-none text-sm font-black text-white">{t('lifelines')}</summary><div className="mt-4 space-y-4">{children}</div></details>}
      <motion.button type="button" disabled={!canStart} whileTap={canStart ? { scale: .985 } : undefined} onClick={onStartGame} className={cn('w-full rounded-xl px-4 py-3 text-sm font-black transition', canStart ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5' : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500')}>{canStart ? `${t('next')} →` : t('chooseRequirements')}</motion.button>
    </motion.aside>
  )
}

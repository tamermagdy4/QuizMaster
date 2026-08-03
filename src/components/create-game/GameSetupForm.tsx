import { motion } from 'framer-motion'
import { GlassInput } from '../ui/GlassInput'
import { PlayerCounter } from './PlayerCounter'
import { TeamSelectionProgress } from './TeamSelectionProgress'
import type { TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

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
}

export function GameSetupForm({
  className,
  gameName,
  team1Name,
  team2Name,
  team1Players,
  team2Players,
  team1Count,
  team2Count,
  activeTeam,
  canStart,
  onGameNameChange,
  onTeam1NameChange,
  onTeam2NameChange,
  onTeam1PlayersDecrease,
  onTeam1PlayersIncrease,
  onTeam2PlayersDecrease,
  onTeam2PlayersIncrease,
  onStartGame,
}: GameSetupFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('glass-panel-strong sticky top-28 space-y-6 rounded-2xl p-6', className)}
    >
      <div>
        <h1 className="text-2xl font-bold text-white">إنشاء لعبة</h1>
        <p className="mt-1 text-sm text-white/60">أعدّ تفاصيل المسابقة واختر الفئات</p>
      </div>

      <GlassInput
        label="اسم اللعبة"
        placeholder="مثال: مسابقة العائلة"
        value={gameName}
        onChange={(e) => onGameNameChange(e.target.value)}
      />

      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <GlassInput
          label="اسم الفريق الأول"
          placeholder="مثال: النمور"
          value={team1Name}
          onChange={(e) => onTeam1NameChange(e.target.value)}
        />
        <PlayerCounter
          label="عدد اللاعبين — الفريق الأول"
          value={team1Players}
          onDecrease={onTeam1PlayersDecrease}
          onIncrease={onTeam1PlayersIncrease}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <GlassInput
          label="اسم الفريق الثاني"
          placeholder="مثال: الصقور"
          value={team2Name}
          onChange={(e) => onTeam2NameChange(e.target.value)}
        />
        <PlayerCounter
          label="عدد اللاعبين — الفريق الثاني"
          value={team2Players}
          onDecrease={onTeam2PlayersDecrease}
          onIncrease={onTeam2PlayersIncrease}
        />
      </div>

      <TeamSelectionProgress
        team1Name={team1Name}
        team2Name={team2Name}
        team1Count={team1Count}
        team2Count={team2Count}
        activeTeam={activeTeam}
      />

      <motion.button
        type="button"
        disabled={!canStart}
        whileHover={canStart ? { scale: 1.02 } : undefined}
        whileTap={canStart ? { scale: 0.98 } : undefined}
        onClick={onStartGame}
        className={cn(
          'w-full rounded-xl py-3.5 text-base font-bold transition',
          canStart
            ? 'glass-button text-white'
            : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/35',
        )}
      >
        {canStart ? 'ابدأ اللعبة' : 'اختر ٣ فئات لكل فريق للبدء'}
      </motion.button>
    </motion.div>
  )
}

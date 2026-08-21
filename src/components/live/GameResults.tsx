import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { LivePlayerRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar } from './shared'
import { Trophy, Medal } from 'lucide-react'

export function GameResults({
  players,
  english,
  totalQuestions,
  isHost,
  myPlayer,
  starting,
  onPlayAgain,
  onOpenHistory,
  packId,
}: {
  players: LivePlayerRow[]
  english: boolean
  totalQuestions: number
  isHost: boolean
  myPlayer: LivePlayerRow | null
  starting: boolean
  onPlayAgain: () => void
  onOpenHistory: () => void
  packId: string
}) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const winner = sorted[0] ?? null
  const myRank = myPlayer ? sorted.findIndex((p) => p.id === myPlayer.id) + 1 : 0



  return (
    <div className="space-y-6">
      {/* Trophy celebration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="glass-dark rounded-3xl p-8 text-center"
      >
        <div className="mb-4 inline-flex">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold/50 bg-gold/20"><Trophy className="h-10 w-10 text-gold-bright" /></span>
        </div>

        <h2 className="font-display text-3xl font-black text-cream">
          {english ? 'Game Over!' : 'انتهت اللعبة!'}
        </h2>
        <p className="mt-2 text-sm text-teal-bright/50">
          {totalQuestions} {english ? 'Questions' : 'سؤال'} · {players.length} {english ? 'Players' : 'لاعب'}
        </p>

        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <p className="text-sm font-bold text-teal-bright/60 mb-3">
              {english ? 'Winner' : 'الفائز'}
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold/50 bg-gold/20 shadow-glow-gold">
                <PlayerAvatar player={winner} size="lg" />
              </div>
              <div>
                <p className="font-display text-2xl font-black text-cream">{winner.name}</p>
                <p className="text-lg font-black text-gold-bright">
                  {winner.score} {english ? 'points' : 'نقطة'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-dark rounded-3xl p-6"
      >
        <h3 className="font-display text-lg font-black text-cream mb-4">
          {english ? 'Final Standings' : 'الترتيب النهائي'}
          <span className="ms-2 text-xs font-bold text-teal-bright/40">
            #{packId.slice(0, 8)}
          </span>
        </h3>

        <div className="space-y-2">
          {sorted.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3',
                i === 0 ? 'border-gold/40 bg-gold/8' : i === 1 ? 'border-petro-line-strong bg-petro-700/50' : i === 2 ? 'border-petro-line bg-petro-800/50' : 'border-petro-line bg-petro-800/30',
              )}
            >
              <span className="w-8 text-center text-xl">
                {i < 3 ? <Medal className="h-5 w-5 text-gold-bright" /> : `#${i + 1}`}
              </span>
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-cream">{player.name}</p>
                <p className="text-[10px] text-teal-bright/50">
                  ✓ {player.correct_count} · ✗ {player.wrong_count}
                </p>
              </div>
              <span className="font-display text-xl font-black tabular-nums text-cream">
                {player.score}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Your result */}
      {myPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-teal-bright/30 bg-teal/8 p-5 text-center"
        >
          <p className="text-sm font-bold text-teal-bright/60 mb-1">{english ? 'Your Result' : 'نتيجمت'}</p>
          <p className="font-display text-3xl font-black text-cream">
            #{myRank} <span className="text-lg text-teal-bright/50">/ {players.length}</span>
          </p>
          <p className="mt-1 text-lg font-black text-teal-bright">
            {myPlayer.score} {english ? 'points' : 'نقطة'}
          </p>
        </motion.div>
      )}

      {/* Actions */}        <div className="flex gap-3">
        <button
          type="button"
          onClick={onOpenHistory}
          className="btn btn-ghost rounded-2xl px-4 py-3 text-sm"
        >
          📊 {english ? 'View History' : 'سجل الجولات'}
        </button>
        {isHost && (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={starting}
            className="btn btn-gold flex-1 rounded-2xl py-3"
          >
            🔄 {english ? 'Play Again' : 'العب مرة أخرى'}
          </button>
        )}
        <Link to={`/`} className="btn btn-ghost rounded-2xl px-4 py-3 text-center text-sm">
          🏠 {english ? 'Back to Home' : 'العودة للرئيسية'}
        </Link>
      </div>
    </div>
  )
}

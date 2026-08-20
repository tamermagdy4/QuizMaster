import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { LivePlayerRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar, OnlineDot, BestStatBadge, RankBadge } from './shared'

/** Final results leaderboard. */
export function Leaderboard({ players, english, totalQuestions }: { players: LivePlayerRow[]; english: boolean; totalQuestions: number }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const safeTotal = Math.max(totalQuestions || 1, 1)
  return (
    <div className="space-y-3">
      {sorted.map((player, index) => {
        const answered = player.correct_count + player.wrong_count
        const correctPct = Math.min(Math.round((player.correct_count / safeTotal) * 100), 100)
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.07, 0.6) }}
            className={cn(
              'rounded-2xl border p-4',
              index === 0 ? 'border-gold/50 bg-gold/10' : 'border-border-soft bg-white/80',
            )}
          >
            <div className="flex items-center gap-4">
              <RankBadge rank={index} />
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-black', index === 0 ? 'text-gold-bright' : 'text-navy')}>{player.name}</p>
                <p className="text-xs font-bold text-muted">
                  {answered} {english ? 'answers' : 'إجابة'}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                      style={{ width: `${correctPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                    {player.correct_count} / {totalQuestions}
                  </span>
                </div>
              </div>
              <span className="font-display text-2xl font-black text-gold">{player.score}</span>
              <span className="text-xs font-bold text-muted">{english ? 'pts' : 'نقطة'}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-soft pt-3 text-center sm:grid-cols-4">
              <div className="rounded-xl bg-green/5 px-2 py-2">
                <p className="text-lg font-black text-green">✓ {player.correct_count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Correct' : 'صحيحة'}</p>
              </div>
              <div className="rounded-xl bg-red/5 px-2 py-2">
                <p className="text-lg font-black text-red">✗ {player.wrong_count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Wrong' : 'خاطئة'}</p>
              </div>
              <div className="rounded-xl bg-navy/5 px-2 py-2">
                <p className="text-lg font-black text-navy">{player.avg_wager}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Avg wager' : 'متوسط الرهان'}</p>
              </div>
              <div className="rounded-xl bg-gold/10 px-2 py-2">
                <p className="text-lg font-black text-gold">★ {player.best_win_wager || '—'}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Best win' : 'أعلى رهان رابح'}</p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** Compact realtime leaderboard (updates live as the host reviews answers). */
export function LeaderboardPanel({ players, english, totalQuestions }: { players: LivePlayerRow[]; english: boolean; totalQuestions: number }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const safeTotal = Math.max(totalQuestions || 1, 1)
  const [filter, setFilter] = useState<'all' | 'correct' | 'wagers'>('all')
  const showAnswers = filter !== 'wagers'
  const showWagers = filter !== 'correct'
  const maxCorrect = sorted.reduce((max, p) => Math.max(max, p.correct_count), 0)
  const maxAvgWager = sorted.reduce((max, p) => Math.max(max, p.avg_wager), 0)
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-black text-navy">
          🏆 {english ? 'Live leaderboard' : 'لوحة الصدارة'}
        </h3>
        <div className="flex items-center gap-0.5 rounded-full border border-border-soft bg-white/70 p-0.5" role="group" aria-label={english ? 'Show stats' : 'عرض الإحصاءات'}>
          {(
            [
              { id: 'all', label: english ? 'All' : 'الكل' },
              { id: 'correct', label: english ? 'Correct' : 'الصحيحة' },
              { id: 'wagers', label: english ? 'Wagers' : 'الرهانات' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60',
                filter === option.id
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-muted hover:bg-white hover:text-navy',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {sorted.length === 0 && <p className="text-sm text-muted">{english ? 'No players yet.' : 'لا يوجد لاعبون بعد.'}</p>}
        {sorted.map((player, index) => {
          const correctPct = Math.min(Math.round((player.correct_count / safeTotal) * 100), 100)
          const isBestCorrect = player.correct_count > 0 && player.correct_count === maxCorrect
          const isBestAvgWager = player.avg_wager > 0 && player.avg_wager === maxAvgWager
          return (
            <div
              key={player.id}
              className={cn(
                'rounded-xl border px-3 py-2',
                index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-surface-raised/70',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 shrink-0 text-sm" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-black text-navy">{player.name}</span>
                    <OnlineDot connected={player.connected} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-black tabular-nums">
                    {showAnswers && (
                      <span className="text-green">
                        ✓ {player.correct_count}
                        {isBestCorrect && <BestStatBadge label={english ? 'Most correct answers' : 'الأكثر إجابات صحيحة'} title={english ? 'Most correct' : 'الأكثر صحة'} />}
                      </span>
                    )}
                    {showAnswers && <span className="text-red">✗ {player.wrong_count}</span>}
                    {showWagers && (
                      <span className="text-navy">
                        {english ? 'avg' : 'متوسط'}: {player.avg_wager}
                        {isBestAvgWager && <BestStatBadge label={english ? 'Highest average wager' : 'الأعلى متوسط رهان'} title={english ? 'Highest avg wager' : 'الأعلى متوسط رهان'} />}
                      </span>
                    )}
                    {showWagers && <span className="text-gold">★ {player.best_win_wager || '—'}</span>}
                  </p>
                  {showAnswers && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                          style={{ width: `${correctPct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                        {player.correct_count} / {totalQuestions}
                      </span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Cumulative judged-question summary — per player, the total correct/wrong verdicts. */
export function CumulativeSummary({ players, english }: { players: LivePlayerRow[]; english: boolean }) {
  const sorted = useMemo(
    () => [...players].sort(
      (a, b) => (b.correct_count + b.wrong_count) - (a.correct_count + a.wrong_count) || b.correct_count - a.correct_count,
    ),
    [players],
  )
  const maxJudged = Math.max(1, ...sorted.map((p) => p.correct_count + p.wrong_count))
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
      <h3 className="font-black text-navy">📊 {english ? 'Cumulative summary' : 'الملخص التراكمي'}</h3>
      <p className="mt-0.5 text-[11px] font-bold text-muted">
        {english ? 'Judged questions this round — per player' : 'إجمالي الأسئلة المحكومة عبر الجولة — لكل لاعب'}
      </p>
      <div className="mt-3 space-y-2">
        {sorted.length === 0 && <p className="text-sm text-muted">{english ? 'No players yet.' : 'لا يوجد لاعبون بعد.'}</p>}
        {sorted.map((player) => {
          const judged = player.correct_count + player.wrong_count
          const accuracy = judged > 0 ? Math.round((player.correct_count / judged) * 100) : 0
          return (
            <div key={player.id} className="rounded-xl border border-border-soft bg-white/60 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <PlayerAvatar player={player} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
                <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                  {english ? 'judged' : 'مُحكم'}: {judged}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                    style={{ width: `${Math.round((judged / maxJudged) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-black tabular-nums">
                <span className="text-green">✓ {player.correct_count}</span>
                <span className="text-red">✗ {player.wrong_count}</span>
                <span className={cn('ms-auto rounded-full px-1.5 py-0.5', accuracy >= 60 ? 'bg-green/10 text-green' : accuracy >= 40 ? 'bg-gold/10 text-gold' : 'bg-red/10 text-red')}>
                  {accuracy}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

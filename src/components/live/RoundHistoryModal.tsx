import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LiveRoundHistoryRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { Mic, Trophy } from 'lucide-react'

/** Round history modal — lists finished rounds with expandable results. */
export function RoundHistoryModal({
  open,
  loading,
  rounds,
  packTitle,
  english,
  onClose,
}: {
  open: boolean
  loading: boolean
  rounds: LiveRoundHistoryRow[]
  packTitle: string
  english: boolean
  onClose: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          dir={english ? 'ltr' : 'rtl'}
        >
          <motion.div className="absolute inset-0 bg-black/85" onClick={onClose} aria-hidden />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={english ? 'Round history' : 'سجل الجولات'}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border-soft bg-white shadow-raised"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-white/70 px-5 py-4">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-display text-lg font-black text-navy">
                  📜 {english ? 'Round history' : 'سجل الجولات'}
                </h3>
                <p className="mt-0.5 truncate text-xs font-bold text-muted">{packTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={english ? 'Close' : 'إغلاق'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-white text-navy transition hover:bg-navy hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {loading ? (
                <p className="py-8 text-center text-sm font-bold text-muted">{english ? 'Loading…' : 'جارٍ التحميل…'}</p>
              ) : rounds.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-muted">
                  {english ? 'No completed rounds yet.' : 'لا توجد جولات مكتملة بعد.'}
                </p>
              ) : (
                rounds.map((round) => {
                  const expanded = expandedId === round.id
                  const date = new Date(round.finished_at)
                  const dateLabel = date.toLocaleDateString(english ? 'en-US' : 'ar-EG', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  return (
                    <div key={round.id} className="overflow-hidden rounded-2xl border border-border-soft bg-white/70">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-xs font-black text-navy">
                            🏁 {dateLabel}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-bold text-muted">
                            <Mic className="mr-1 inline h-3 w-3" /> {round.host_name} · {round.question_count} {english ? 'questions' : 'أسئلة'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {round.winner_name && (
                            <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-black text-gold">
                              <Trophy className="mr-1 inline h-3 w-3 text-gold" /> {round.winner_name} · {round.winner_score}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : round.id)}
                            aria-expanded={expanded}
                            className="rounded-lg border border-border-soft bg-white px-2.5 py-1 text-[11px] font-black text-navy transition hover:border-gold/50 hover:text-gold"
                          >
                            {expanded ? (english ? 'Hide' : 'إخفاء') : (english ? 'Results' : 'النتائج')}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 border-t border-border-soft bg-white/40 px-4 py-3">
                              {round.players.length === 0 ? (
                                <p className="text-xs font-bold text-muted">{english ? 'No players.' : 'لا يوجد لاعبون.'}</p>
                              ) : (
                                round.players.map((player, index) => (
                                  <div
                                    key={`${round.id}-${index}`}
                                    className={cn(
                                      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2',
                                      index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-white/60',
                                    )}
                                  >
                                    <span className="w-5 shrink-0 text-xs" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                                      ✓ {player.correct_count} · ✗ {player.wrong_count}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                                      {english ? 'avg' : 'متوسط'}: {player.avg_wager}
                                    </span>
                                    <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

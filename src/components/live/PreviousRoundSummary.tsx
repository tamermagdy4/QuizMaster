import type { LiveRoundHistoryRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'

/** Previous-round summary shown in a NEW lobby — final ranking + points. */
export function PreviousRoundSummary({ round, english }: { round: LiveRoundHistoryRow; english: boolean }) {
  const date = new Date(round.finished_at)
  const dateLabel = date.toLocaleDateString(english ? 'en-US' : 'ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const top = round.players.slice(0, 5)
  return (
    <div className="rounded-3xl border border-gold/40 bg-white/85 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-navy">🏆 {english ? 'Previous round' : 'الجولة السابقة'}</h3>
        <span className="text-[11px] font-bold text-muted">{dateLabel}</span>
      </div>
      {round.winner_name && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-sm font-black text-gold">
          👑 {english ? 'Winner' : 'الفائز'}: {round.winner_name} · {round.winner_score} {english ? 'pts' : 'نقطة'}
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {top.map((player, index) => (
          <div
            key={`${round.id}-${index}`}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2',
              index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-white/60',
            )}
          >
            <span className="w-5 shrink-0 text-sm" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
            <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
          </div>
        ))}
      </div>
      {round.players.length > top.length && (
        <p className="mt-2 text-[11px] font-bold text-muted">
          {english ? `And ${round.players.length - top.length} more…` : `و${round.players.length - top.length} آخرون…`}
        </p>
      )}
    </div>
  )
}

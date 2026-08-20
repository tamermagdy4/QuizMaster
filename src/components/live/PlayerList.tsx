import type { LivePlayerRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar, OnlineDot } from './shared'

export function PlayerList({ players, english, title, compact }: { players: LivePlayerRow[]; english: boolean; title: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel', compact && 'p-4')}>
      <h3 className="font-black text-navy">{title}</h3>
      <div className={cn('mt-3 grid gap-2', players.length > 4 ? 'sm:grid-cols-2' : '')}>
        {players.length === 0 && (
          <p className="text-sm text-muted">{english ? 'Waiting for players…' : 'في انتظار اللاعبين…'}</p>
        )}
        {players.map((player) => (
          <div key={player.id} className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-surface-raised/70 px-3 py-2.5">
            <PlayerAvatar player={player} size="sm" />
            <OnlineDot connected={player.connected} />
            <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
            {player.connected ? (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-green">{english ? 'Online' : 'متصل'}</span>
            ) : (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-red/80">{english ? 'Offline' : 'غير متصل'}</span>
            )}
            {player.score !== 0 && (
              <span className={cn('shrink-0 text-xs font-black tabular-nums', player.score > 0 ? 'text-gold' : 'text-red')}>
                {player.score > 0 ? `★ ${player.score}` : player.score}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

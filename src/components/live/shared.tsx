import { useEffect, useState } from 'react'
import type { LivePlayerRow, LiveRoomRow } from '../../services/livePackService'
import { getLiveQuestionRemainingMs } from '../../services/livePackService'
import { cn } from '../../utils/cn'

// ---------------------------------------------------------------------------
// Shared hooks
// ---------------------------------------------------------------------------

/**
 * Shared per-question countdown. Derives the deadline from the room's
 * question_started_at + question_timeout_seconds (the DB is the source of
 * truth), so every client shows the exact same remaining time.
 */
export function useQuestionCountdown(room: LiveRoomRow | null): { remainingSeconds: number | null; expired: boolean } {
  const [, setNow] = useState(0)
  const playing = Boolean(room && room.status === 'playing' && room.question_started_at)
  useEffect(() => {
    if (!playing) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [playing, room?.id, room?.question_started_at, room?.question_timeout_seconds])
  if (!playing || !room) return { remainingSeconds: null, expired: false }
  const ms = getLiveQuestionRemainingMs(room)
  if (ms === null) return { remainingSeconds: null, expired: false }
  const remainingSeconds = Math.ceil(ms / 1000)
  return { remainingSeconds, expired: remainingSeconds <= 0 }
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

/** Avatar: real user image when available, otherwise the first letter. */
export function PlayerAvatar({ player, size = 'md' }: { player: LivePlayerRow; size?: 'sm' | 'md'| 'lg' }) {
  const classes = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm'
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.name}
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full border border-white/40 object-cover shadow-sm', classes)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-b from-teal to-navy font-black text-gold-bright', classes)}
    >
      {(player.name || '؟').trim().charAt(0)}
    </span>
  )
}

export function OnlineDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        connected ? 'bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red/70',
      )}
      aria-hidden
    />
  )
}

export function QuestionTimer({ remainingSeconds, english }: { remainingSeconds: number | null; english: boolean }) {
  if (remainingSeconds === null) return null
  const expired = remainingSeconds <= 0
  const urgent = !expired && remainingSeconds <= 10
  return (
    <span
      dir="ltr"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tabular-nums',
        expired ? 'border-red/60 bg-red/15 text-red' : urgent ? 'border-red/50 bg-red/10 text-red' : 'border-gold/50 bg-gold/10 text-gold-bright',
      )}
    >
      <span aria-hidden>⏱</span>
      {expired ? (english ? 'Time up' : 'انتهى الوقت') : `${remainingSeconds}s`}
    </span>
  )
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <span className="text-2xl" aria-hidden>🏆</span>
  if (rank === 1) return <span className="text-2xl" aria-hidden>🥈</span>
  if (rank === 2) return <span className="text-2xl" aria-hidden>🥉</span>
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-sm font-black text-muted">
      {rank + 1}
    </span>
  )
}

/** Tiny gold crown badge marking the best player in a given stat. */
export function BestStatBadge({ label, title }: { label: string; title: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={title}
      className="ms-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold/25 text-[9px] leading-none shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    >
      👑
    </span>
  )
}

/**
 * Accuracy badge shown next to the wager bar value — derived from where the
 * player's choice sits in the wager range.
 */
export function WagerLevelBadge({ wager, min, max, english }: { wager: number | null; min: number; max: number; english: boolean }) {
  if (wager === null) return null
  const span = max - min
  const ratio = span > 0 ? (wager - min) / span : 0.5
  const level = ratio < 1 / 3 ? 'precise' : ratio > 2 / 3 ? 'confident' : 'moderate'
  const config =
    level === 'precise'
      ? { label: english ? 'Precise' : 'دقيقة', icon: '🎯', cls: 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]' }
      : level === 'confident'
        ? { label: english ? 'Confident' : 'واثق', icon: '💪', cls: 'border-green/40 bg-green/10 text-green' }
        : { label: english ? 'Moderate' : 'متوسطة', icon: '⚖️', cls: 'border-gold/40 bg-gold/10 text-gold' }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black', config.cls)}>
      <span aria-hidden className="text-[9px] leading-none">{config.icon}</span>
      {config.label}
    </span>
  )
}

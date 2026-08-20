import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LiveAnswerRow, LiveRoomRow } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { WagerLevelBadge } from './shared'

/**
 * Shared answer composer: wager picker (every value 1..max, where max =
 * the question count) + answer input. Used by players AND the host — the
 * host is also a player, so they pick their own value and submit their own
 * answer like everyone else.
 */
export function AnswerComposer({
  room,
  myAnswer,
  expired,
  english,
  onSubmit,
  busy,
}: {
  room: LiveRoomRow
  myAnswer: LiveAnswerRow | null
  expired: boolean
  english: boolean
  onSubmit: (wager: number, text: string) => void
  busy: boolean
}) {
  const index = room.current_question_index
  const [wager, setWager] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const submitted = Boolean(myAnswer)
  const reviewed = myAnswer?.reviewed_by_host ?? false
  const lockedWager = myAnswer?.wager ?? wager

  // Gold fill on the slider track — follows the chosen value (RTL-aware).
  const fillPercent = room.max_wager > room.min_wager
    ? Math.round(((wager ?? room.min_wager) - room.min_wager) / (room.max_wager - room.min_wager) * 100)
    : 100

  // Each new question starts a fresh wager + answer (the index is shared).
  useEffect(() => {
    setWager(null)
    setDraft('')
  }, [index])

  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:p-6">
      <AnimatePresence mode="wait">
        {expired && !submitted ? (
          <motion.div key="expired" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4 text-center">
            <span className="text-4xl" aria-hidden>⏰</span>
            <p className="mt-2 text-lg font-black text-red">{english ? "Time's up for this question" : 'انتهى وقت السؤال'}</p>
            <p className="mt-1 text-sm font-bold text-muted">
              {room.question_phase === 'closed'
                ? english ? 'Answering is closed — waiting for the host to review.' : 'أُغلق استقبال الإجابات — بانتظار مراجعة المضيف.'
                : english ? 'Waiting for the host…' : 'بانتظار المضيف…'}
            </p>
          </motion.div>
        ) : reviewed ? (
          <motion.div key="reviewed" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-4 text-center">
            {myAnswer?.status === 'correct' ? (
              <>
                <span className="text-4xl" aria-hidden>🎉</span>
                <p className="mt-2 text-xl font-black text-green">{english ? 'Correct answer!' : 'إجابة صحيحة!'}</p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {english ? `You earned +${myAnswer?.points ?? 0} points` : `ربحت +${myAnswer?.points ?? 0} نقطة`}
                </p>
              </>
            ) : (
              <>
                <span className="text-4xl" aria-hidden>❌</span>
                <p className="mt-2 text-xl font-black text-red">{english ? 'Wrong answer' : 'إجابة خاطئة'}</p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {myAnswer && myAnswer.points < 0
                    ? english ? `You lost ${Math.abs(myAnswer.points)} points` : `خسرت ${Math.abs(myAnswer.points)} نقطة`
                    : english ? 'No points this time.' : 'لا نقاط هذه المرة.'}
                </p>
              </>
            )}
          </motion.div>
        ) : submitted ? (
          <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4 text-center">
            <span className="text-4xl" aria-hidden>✅</span>
            <p className="mt-2 text-lg font-black text-green">{english ? 'Answer sent' : 'تم إرسال الإجابة ✓'}</p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-gold">
              <span>{english ? `Wager: ${lockedWager} points` : `النقاط المختارة: ${lockedWager}`}</span>
              <WagerLevelBadge wager={lockedWager} min={room.min_wager} max={room.max_wager} english={english} />
            </p>
            <p className="mt-1 text-sm font-bold text-muted">{english ? 'Waiting for the host to review…' : 'في انتظار مراجعة المضيف…'}</p>
            <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-2.5 text-sm font-bold text-navy">
              {myAnswer?.answer_text}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Wager picker — slider from 1 to max (max = question count) */}
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
                {english ? 'Choose the value of your answer' : 'اختر قيمة إجابتك'}
              </p>
              <p className="mt-1 text-[11px] font-bold text-muted/80">
                {english ? `1 to ${room.max_wager} points — your choice, per question` : `من 1 إلى ${room.max_wager} نقطة — اختيارك لكل سؤال`}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span
                  className={cn(
                    'rounded-2xl border px-7 py-2 font-display text-3xl font-black tabular-nums transition-all duration-200',
                    wager === null
                      ? 'border-border-strong bg-surface-raised text-muted'
                      : 'border-gold/60 bg-gold text-navy shadow-[0_10px_24px_rgba(201,162,39,0.35)]',
                  )}
                >
                  {wager ?? '—'}
                </span>
                <span className="text-sm font-black text-muted">{english ? 'pts' : 'نقطة'}</span>
                <WagerLevelBadge wager={wager} min={room.min_wager} max={room.max_wager} english={english} />
              </div>

              <div dir={english ? 'ltr' : 'rtl'} className="mx-auto mt-5 max-w-md px-2">
                <input
                  type="range"
                  min={room.min_wager}
                  max={room.max_wager}
                  step={1}
                  value={wager ?? room.min_wager}
                  onChange={(event) => setWager(Number(event.target.value))}
                  aria-label={english ? 'Wager value' : 'قيمة الرهان'}
                  className="fahloy-range w-full"
                  style={{ '--fill': `${fillPercent}%` } as CSSProperties}
                />
                <div className="mt-1.5 flex justify-between text-[11px] font-black tabular-nums text-muted/70">
                  <span>{room.min_wager}</span>
                  <span>{room.max_wager}</span>
                </div>
              </div>

              <p className="mt-2 text-sm font-black text-gold">
                {wager === null
                  ? english ? 'Move the slider to pick your value' : 'حرّك المؤشر لاختيار قيمتك'
                  : `${english ? 'Your wager' : 'قيمة السؤال'}: ${wager} ${english ? 'points' : 'نقطة'}`}
              </p>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (wager !== null && draft.trim()) onSubmit(wager, draft.trim())
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 300))}
                placeholder={english ? 'Type your answer…' : 'اكتب إجابتك…'}
                disabled={wager === null}
                className="w-full rounded-2xl border border-border-strong bg-white px-4 py-4 text-center text-base font-bold text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-surface-raised disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || wager === null || !draft.trim()}
                className="w-full rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3.5 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-50"
              >
                {english ? 'Send answer' : 'إرسال الإجابة'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

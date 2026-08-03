import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { BoardGrid } from '../components/game-board/BoardGrid'
import { LifelineList } from '../components/game-board/LifelineList'
import type { TeamId } from '../types/game'
import { useGameBoardStore } from '../store/gameBoardStore'
import { getCategoryById } from '../utils/categories'
import { cn } from '../utils/cn'

type SoundType = 'select' | 'reveal' | 'correct' | 'wrong' | 'turn' | 'timer'
type ResolveTone = 'success' | 'neutral' | null

export function GameBoard() {
  const navigate = useNavigate()
  const {
    gameName,
    team1Name,
    team2Name,
    categoryIds,
    cells,
    currentTurn,
    team1Score,
    team2Score,
    team1Lifelines,
    team2Lifelines,
    activeQuestion,
    isCellPlayable,
    selectQuestion,
    switchTurn,
    resolveQuestion,
  } = useGameBoardStore()

  const audioContextRef = useRef<AudioContext | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [burst, setBurst] = useState<{ team: TeamId; points: number } | null>(null)
  const [resolveTone, setResolveTone] = useState<ResolveTone>(null)

  const activeCategory = useMemo(
    () => (activeQuestion ? getCategoryById(activeQuestion.categoryId) : undefined),
    [activeQuestion],
  )

  useEffect(() => {
    if (!activeQuestion) {
      setIsRevealed(false)
      setCountdown(30)
      setResolveTone(null)
      return
    }

    setIsRevealed(false)
    setCountdown(30)
    setResolveTone(null)

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          setIsRevealed(true)
          playSound('timer')
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [activeQuestion])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeQuestion) {
        setIsRevealed(false)
      }

      if (event.key === '1') {
        event.preventDefault()
        if (activeQuestion) {
          handleResolve(1)
        }
      }

      if (event.key === '2') {
        event.preventDefault()
        if (activeQuestion) {
          handleResolve(2)
        }
      }

      if (event.key === '0') {
        event.preventDefault()
        if (activeQuestion) {
          handleResolve(null)
        }
      }

      if (event.code === 'Space' && activeQuestion) {
        event.preventDefault()
        setIsRevealed(true)
        playSound('reveal')
      }

      if (event.key.toLowerCase() === 'r') {
        switchTurn()
        playSound('turn')
      }

      if (event.key.toLowerCase() === 'c' && activeQuestion) {
        event.preventDefault()
        handleResolve(1)
      }

      if (event.key.toLowerCase() === 'w' && activeQuestion) {
        event.preventDefault()
        handleResolve(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeQuestion, resolveQuestion, switchTurn])

  const playSound = (type: SoundType) => {
    if (!soundEnabled || typeof window === 'undefined') return

    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    const context = audioContextRef.current ?? new AudioCtor()
    audioContextRef.current = context

    if (context.state === 'suspended') {
      void context.resume()
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type === 'wrong' || type === 'timer' ? 'sawtooth' : 'triangle'
    oscillator.frequency.value =
      type === 'select'
        ? 420
        : type === 'reveal'
          ? 620
          : type === 'correct'
            ? 780
            : type === 'wrong'
              ? 180
              : type === 'timer'
                ? 260
                : 520

    gain.gain.value = type === 'timer' ? 0.06 : 0.04
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + (type === 'timer' ? 0.28 : 0.14))
  }

  const handleSelectCell = (categoryId: string, slotIndex: number) => {
    const question = selectQuestion(categoryId, slotIndex)
    if (!question) return

    playSound('select')
  }

  useEffect(() => {
    if (cells.length === 0) return

    const allUsed = cells.flat().every((cell) => cell.team1Played && cell.team2Played)
    if (allUsed) {
      navigate('/results')
    }
  }, [cells, navigate])

  const handleRevealAnswer = () => {
    if (!activeQuestion) return
    setIsRevealed(true)
    playSound('reveal')
  }

  const handleResolve = (winner: TeamId | null) => {
    if (!activeQuestion) return

    const points = activeQuestion.points
    if (winner === 1 || winner === 2) {
      setBurst({ team: winner, points })
      window.setTimeout(() => setBurst(null), 1100)
    }

    setResolveTone(winner === null ? 'neutral' : 'success')
    resolveQuestion(winner)
    playSound(winner === null ? 'wrong' : 'correct')
  }

  return (
    <div className="space-y-6">
      <GlassCard strong className="overflow-hidden">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-gold-400">مسابقة مباشرة</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{gameName}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((value) => !value)}
              className="glass-button rounded-xl px-3 py-2 text-sm font-semibold text-white"
            >
              {soundEnabled ? 'الصوت: مفعل' : 'الصوت: متوقف'}
            </button>
            <button
              type="button"
              onClick={switchTurn}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
            >
              تبديل الدور
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <motion.div
                animate={{ scale: currentTurn === 1 ? [1, 1.03, 1] : 1 }}
                className={cn(
                  'rounded-2xl border p-4',
                  currentTurn === 1
                    ? 'border-royal-400/45 bg-royal-500/10 shadow-glow-royal'
                    : 'border-white/10 bg-white/5',
                )}
              >
                <p className="mb-2 text-xs text-white/60">الفريق الأول</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{team1Name}</h2>
                    <p className="text-sm text-white/60">الدور الحالي: {currentTurn === 1 ? 'نشيط' : 'بانتظار'}</p>
                  </div>
                  <motion.span
                    key={`team1-${team1Score}`}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl font-black text-royal-400"
                  >
                    {team1Score}
                  </motion.span>
                </div>
              </motion.div>

              <motion.div
                animate={{ scale: currentTurn === 2 ? [1, 1.03, 1] : 1 }}
                className={cn(
                  'rounded-2xl border p-4',
                  currentTurn === 2
                    ? 'border-gold-400/45 bg-gold-500/10 shadow-glow-gold'
                    : 'border-white/10 bg-white/5',
                )}
              >
                <p className="mb-2 text-xs text-white/60">الفريق الثاني</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{team2Name}</h2>
                    <p className="text-sm text-white/60">الدور الحالي: {currentTurn === 2 ? 'نشيط' : 'بانتظار'}</p>
                  </div>
                  <motion.span
                    key={`team2-${team2Score}`}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl font-black text-gold-400"
                  >
                    {team2Score}
                  </motion.span>
                </div>
              </motion.div>
            </div>

            <BoardGrid
              categoryIds={categoryIds}
              cells={cells}
              currentTurn={currentTurn}
              isCellPlayable={isCellPlayable}
              onSelectCell={handleSelectCell}
            />
          </div>

          <div className="space-y-4">
            <GlassCard className="space-y-3" strong>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">المساعدات</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
                  {currentTurn === 1 ? team1Name : team2Name}
                </span>
              </div>
              <LifelineList lifelines={currentTurn === 1 ? team1Lifelines : team2Lifelines} accent={currentTurn === 1 ? 'royal' : 'gold'} />
            </GlassCard>

            <GlassCard className="space-y-2" strong>
              <h2 className="text-lg font-bold text-white">اختصارات لوحة المفاتيح</h2>
              <ul className="space-y-1 text-sm text-white/70">
                <li>1 / 2: تبديل الفريق النشط</li>
                <li>R: تبديل الدور</li>
                <li>A: عرض الإجابة</li>
                <li>C: تسجيل إجابة صحيحة</li>
                <li>W: تسجيل إجابة خاطئة</li>
                <li>Esc: إغلاق السؤال</li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </GlassCard>

      <AnimatePresence>
        {activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 20, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="glass-panel-strong w-full max-w-2xl rounded-3xl p-5 sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.25em] text-gold-400">سؤال مباشر</p>
                  <h2 className="text-2xl font-bold text-white">{activeCategory?.title ?? 'فئة'}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-sm font-bold text-gold-400">
                    {activeQuestion.points} نقطة
                  </div>
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ scale: countdown <= 5 ? [1, 1.18, 1] : 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm font-bold',
                      countdown <= 5
                        ? 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                        : 'border-white/10 bg-white/5 text-white',
                    )}
                  >
                    {countdown}s
                  </motion.div>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="mb-3 text-sm text-white/70">الطوارئ: {activeQuestion.team === 1 ? team1Name : team2Name}</p>
                <p className="text-lg leading-relaxed text-white">{activeQuestion.questionText}</p>
              </div>

              <AnimatePresence mode="wait">
                {isRevealed && (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 rounded-2xl border border-teal-400/25 bg-teal-500/10 p-4 text-white"
                  >
                    <p className="mb-1 text-xs font-semibold text-teal-300">الإجابة</p>
                    <p className="text-base leading-relaxed">{activeQuestion.answerText}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRevealAnswer}
                  className="glass-button rounded-xl px-4 py-2 font-semibold text-white"
                >
                  إظهار الإجابة
                </motion.button>
              </div>

              <AnimatePresence mode="wait">
                {isRevealed && (
                  <motion.div
                    key="choices"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      'mt-4 grid gap-3 sm:grid-cols-3',
                      resolveTone === 'success' && 'animate-pulse',
                    )}
                  >
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResolve(1)}
                      className="rounded-2xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-5 text-lg font-bold text-emerald-100 shadow-lg shadow-emerald-500/20"
                    >
                      ✅ الفريق الأول أجاب صح
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResolve(2)}
                      className="rounded-2xl border border-amber-400/50 bg-amber-500/20 px-4 py-5 text-lg font-bold text-amber-100 shadow-lg shadow-amber-500/20"
                    >
                      ✅ الفريق الثاني أجاب صح
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResolve(null)}
                      className="rounded-2xl border border-slate-400/50 bg-slate-500/20 px-4 py-5 text-lg font-bold text-slate-100 shadow-lg shadow-slate-500/20"
                    >
                      ❌ لا أحد أجاب
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {burst && (
          <motion.div
            key={`${burst.team}-${burst.points}`}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={cn(
              'pointer-events-none fixed bottom-6 end-6 z-[60] rounded-2xl border px-4 py-3 text-lg font-black shadow-2xl',
              burst.team === 1
                ? 'border-royal-400/45 bg-royal-500/20 text-royal-300'
                : 'border-gold-400/45 bg-gold-500/20 text-gold-300',
            )}
          >
            +{burst.points}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

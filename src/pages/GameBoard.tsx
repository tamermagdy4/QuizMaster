import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BoardGrid } from '../components/game-board/BoardGrid'
import { LifelineList } from '../components/game-board/LifelineList'
import type { LifelineId } from '../types/board'
import type { TeamId } from '../types/game'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useAppStore } from '../store/appStore'
import { getCategoryById } from '../utils/categories'
import { cn } from '../utils/cn'

type SoundType = 'select' | 'reveal' | 'correct' | 'wrong' | 'turn' | 'timer'
type ResolveTone = 'success' | 'neutral' | null

function usePlayerImage(answerText: string | null, isRevealed: boolean) {
  const [playerImageUrl, setPlayerImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!answerText || !isRevealed) {
      setPlayerImageUrl(null)
      return
    }

    const extensions = ['png', 'jpg', 'jpeg', 'webp']
    const basePath = '/media/players'

    let found = false
    extensions.forEach((ext) => {
      if (found) return
      const imagePath = `${basePath}/${answerText}.${ext}`
      const img = new Image()
      img.onload = () => {
        if (!found) {
          found = true
          setPlayerImageUrl(imagePath)
        }
      }
      img.onerror = () => {}
      img.src = imagePath
    })

    const timeout = setTimeout(() => {
      if (!found) {
        setPlayerImageUrl(null)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [answerText, isRevealed])

  return playerImageUrl
}

export function GameBoard() {
  const navigate = useNavigate()
  const { direction, soundEnabled, setSoundEnabled, questionDuration, theme, animationsEnabled } = useAppStore()
  const ui = direction === 'ltr' ? {
    currentTurn: 'Current turn', questionMode: 'Choose a question', directQuestion: 'Direct question', category: 'Category',
    points: 'points', team: 'Team', lifelines: 'Lifelines', shortcuts: 'Keyboard shortcuts', reveal: 'Reveal answer', finish: 'Finish question',
    answerCorrect: 'Correct answer', answerWrong: 'Wrong answer', yourAnswer: 'Your answer', correctAnswer: 'Correct answer',
    useOne: 'You can use one lifeline per question', double: 'Double points — choose a question', noAnswer: 'No one answered',
    teamAnswered: 'answered correctly', blocked: 'Blocked', call: 'Call a friend', closeCall: 'Close call', hint: 'Hint',
  } : {
    currentTurn: 'الدور الحالي', questionMode: 'دوري — اختيار سؤال', directQuestion: 'سؤال مباشر', category: 'فئة',
    points: 'نقطة', team: 'الفريق', lifelines: 'المساعدات', shortcuts: 'اختصارات لوحة المفاتيح', reveal: 'إظهار الإجابة', finish: 'إنهاء السؤال',
    answerCorrect: 'إجابتك صحيحة! ✅', answerWrong: 'إجابتك خاطئة ❌', yourAnswer: 'إجابتك', correctAnswer: 'الإجابة الصحيحة',
    useOne: 'يمكنك استخدام وسيلة مساعدة واحدة فقط في كل سؤال', double: '✕2 مضاعفة النقاط — اختر سؤالاً', noAnswer: '❌ لا أحد أجاب',
    teamAnswered: 'أجاب صح', blocked: 'محظور', call: 'اتصال بصديق', closeCall: 'إغلاق الاتصال', hint: '💡 تلميح',
  }
  const {
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
    pendingDoublePoints,
    blockActive,
    callFriendActive,
    callFriendTimeLeft,
    callFriendHint,
    wheelBonus,
    answerSubmitted,
    selectedAnswer,
    answerCorrect,
    answerPoints,
    isCellPlayable,
    selectQuestion,
    switchTurn,
    resolveQuestion,
    submitAnswer,
    finishSubmittedQuestion,
    useLifeline,
    tickCallFriend,
    clearCallFriend,
  } = useGameBoardStore()

  const audioContextRef = useRef<AudioContext | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [countdown, setCountdown] = useState<number>(questionDuration)
  const [burst, setBurst] = useState<{ team: TeamId; points: number } | null>(null)
  const [resolveTone, setResolveTone] = useState<ResolveTone>(null)

  const playerImageUrl = usePlayerImage(activeQuestion?.answerText || null, isRevealed)

  const activeCategory = useMemo(
    () => (activeQuestion ? getCategoryById(activeQuestion.categoryId) : undefined),
    [activeQuestion],
  )

  useEffect(() => {
    if (!activeQuestion) {
      setIsRevealed(false)
      setCountdown(questionDuration)
      setResolveTone(null)
      return
    }

    if (answerSubmitted) return

    setIsRevealed(false)
    setCountdown(questionDuration)
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
  }, [activeQuestion, answerSubmitted])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeQuestion) {
        setIsRevealed(false)
      }

      if (event.key === '1') {
        event.preventDefault()
        if (activeQuestion && blockActive !== 1) {
          handleResolve(1)
        }
      }

      if (event.key === '2') {
        event.preventDefault()
        if (activeQuestion && blockActive !== 2) {
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
        if (blockActive !== 1) {
          handleResolve(1)
        }
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

  const handleSelectCell = useCallback((categoryId: string, slotIndex: number) => {
    const question = selectQuestion(categoryId, slotIndex)
    if (!question) return

    playSound('select')
  }, [selectQuestion])

  useEffect(() => {
    if (cells.length === 0) return

    const allUsed = cells.flat().every((cell) => cell.team1Played && cell.team2Played)
    if (allUsed) {
      navigate('/results')
    }
  }, [cells, navigate])

  const handleRevealAnswer = () => {
    if (!activeQuestion || answerSubmitted) return
    setIsRevealed(true)
    playSound('reveal')
  }

  const handleResolve = (winner: TeamId | null) => {
    if (!activeQuestion || answerSubmitted) return

    const points = activeQuestion.points
    if (winner === 1 || winner === 2) {
      const displayPoints = activeQuestion.doubleApplied ? points * 2 : points
      setBurst({ team: winner, points: displayPoints })
      window.setTimeout(() => setBurst(null), 1100)
    }

    setResolveTone(winner === null ? 'neutral' : 'success')
    resolveQuestion(winner)
    playSound(winner === null ? 'wrong' : 'correct')
  }

  useEffect(() => {
    if (!callFriendActive || callFriendTimeLeft <= 0) return

    const timer = window.setInterval(() => {
      tickCallFriend()
    }, 1000)

    return () => window.clearInterval(timer)
  }, [callFriendActive, callFriendTimeLeft, tickCallFriend])

  useEffect(() => {
    if (!wheelBonus) return
    const timeout = window.setTimeout(() => {
      useGameBoardStore.setState({ wheelBonus: null })
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [wheelBonus])

  const handleUseLifeline = useCallback((lifelineId: string) => {
    const canUseBeforeQuestion = lifelineId === 'double' || lifelineId === 'wheel'
    if (!canUseBeforeQuestion && (!activeQuestion || isRevealed || activeQuestion.answered)) return
    useLifeline(lifelineId as LifelineId)
    playSound('select')
  }, [activeQuestion, isRevealed, useLifeline])

  const questionTeam = activeQuestion?.team ?? currentTurn
  const currentLifelines = questionTeam === 1 ? team1Lifelines : team2Lifelines

  const getLifelineDisabled = useCallback((lifelineId: string): boolean => {
    const lifeline = currentLifelines.find((l) => l.id === lifelineId)
    if (!lifeline) return true
    if (lifeline.used) return true

    switch (lifelineId) {
      case 'double':
        if (pendingDoublePoints !== null) return true
        if (isRevealed || activeQuestion?.answered || activeQuestion?.lifelineUsed) return true
        return false

      case 'wheel':
        if (isRevealed || activeQuestion?.answered || activeQuestion?.lifelineUsed) return true
        return false

      case 'two-answers':
        if (!activeQuestion) return true
        if (isRevealed) return true
        if (activeQuestion.answered) return true
        if (activeQuestion.twoAnswersUsed) return true
        if (activeQuestion.lifelineUsed) return true
        return false

      case 'block':
        if (!activeQuestion) return true
        if (isRevealed) return true
        if (activeQuestion.answered) return true
        if (blockActive) return true
        if (activeQuestion.lifelineUsed) return true
        return false

      case 'call':
        if (!activeQuestion) return true
        if (isRevealed) return true
        if (activeQuestion.answered) return true
        if (activeQuestion.lifelineUsed) return true
        return false

      default:
        return true
    }
  }, [currentLifelines, pendingDoublePoints, activeQuestion, isRevealed, blockActive])

  const activeLifelineId = useMemo(() => {
    if (pendingDoublePoints === currentTurn) return 'double'
    if (blockActive && blockActive !== currentTurn) return 'block'
    if (callFriendActive === currentTurn) return 'call'
    if (activeQuestion?.twoAnswersUsed) return 'two-answers'
    return null
  }, [pendingDoublePoints, blockActive, callFriendActive, activeQuestion, currentTurn])

  return (
    <div className={cn('game-board-shell min-h-[calc(100vh-8rem)] space-y-5 rounded-[28px] border p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5', animationsEnabled ? 'motion-enabled' : 'motion-reduced', theme === 'light' ? 'theme-light-board border-slate-200 bg-slate-100 text-slate-800' : 'border-white/[0.04] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.06),transparent_32%),#050816]')}>
      {/* ===== Scoreboard: Team 1 | VS | Team 2 ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#334155]/70 bg-gradient-to-br from-[#101A2D] to-[#080E1A] px-3 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.38)] sm:flex-nowrap sm:px-5 sm:py-4">
        {/* Team 2 (right in RTL) */}
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: currentTurn === 2 ? [1, 1.05, 1] : 1 }}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-2xl border-2 px-3 py-2.5 transition-all duration-300 sm:px-4 sm:py-3',
              currentTurn === 2
                ? 'border-[#EF4444]/60 bg-[#EF4444]/10 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                : 'border-[#1E293B] bg-[#0F172A]',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EF4444]/20 text-sm">🛡️</div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-[#FCA5A5]">{team2Name}</span>
              <motion.span key={team2Score} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }} className="text-xl font-black text-[#EF4444] tabular-nums">{team2Score}</motion.span>
            </div>
          </motion.div>
        </div>

        {/* VS + Timer */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="rounded-full border border-[#D4A843]/25 bg-[#D4A843]/10 px-2 py-0.5 text-lg font-black text-[#F5D98B] shadow-[0_0_16px_rgba(212,168,67,0.14)]">VS</span>
            <span className="text-[10px] text-gray-500">36 {ui.points}</span>
          </div>
          <motion.div
            key={countdown}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: countdown <= 5 && activeQuestion ? [1, 1.15, 1] : 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border-2 text-center text-sm font-black tabular-nums shadow-[inset_0_0_12px_rgba(255,255,255,0.04)] transition-colors duration-300',
              activeQuestion
                ? countdown <= 5
                  ? 'border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444] shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                  : 'border-[#D4A843]/50 bg-[#D4A843]/10 text-[#D4A843]'
                : 'border-[#1E293B] bg-[#0F172A] text-gray-500',
            )}
          >
            {activeQuestion ? countdown.toString().padStart(2, '0') : questionDuration.toString()}
          </motion.div>
        </div>

        {/* Team 1 (left in RTL) */}
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: currentTurn === 1 ? [1, 1.05, 1] : 1 }}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-2xl border-2 px-3 py-2.5 transition-all duration-300 sm:px-4 sm:py-3',
              currentTurn === 1
                ? 'border-[#3B82F6]/60 bg-[#3B82F6]/10 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                : 'border-[#1E293B] bg-[#0F172A]',
            )}
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-[#93C5FD]">{team1Name}</span>
              <motion.span key={team1Score} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }} className="text-xl font-black text-[#3B82F6] tabular-nums">{team1Score}</motion.span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6]/20 text-sm">🛡️</div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-lg border border-[#1E293B] bg-[#0F172A] px-2 py-1.5 text-sm text-gray-400 transition hover:bg-[#1E293B] hover:text-gray-300"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            type="button"
            onClick={() => {
              switchTurn()
              playSound('turn')
            }}
            className="rounded-lg border border-[#1E293B] bg-[#0F172A] px-2 py-1.5 text-sm text-gray-400 transition hover:bg-[#1E293B] hover:text-gray-300"
          >
            ⇄
          </button>
        </div>
      </div>

      {/* ===== Turn Indicator Bar ===== */}
      <motion.div key={currentTurn} initial={{ opacity: 0.7, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-xl bg-gradient-to-l from-[#3B82F6]/80 via-[#1E40AF]/80 to-[#1E3A5F]/80 px-5 py-3 shadow-[0_8px_24px_rgba(59,130,246,0.2)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{ui.currentTurn}: {currentTurn === 1 ? team1Name : team2Name}</span>
          </div>
          <div className="flex items-center gap-3">
            {pendingDoublePoints === currentTurn && (
              <span className="rounded-full border border-[#D4A843]/40 bg-[#D4A843]/15 px-3 py-1 text-xs font-bold text-[#D4A843]">
                ✕2 مضاعفة النقاط — اختر سؤالاً
              </span>
            )}
            <span className="text-sm font-bold text-white">{ui.questionMode}</span>
            <span className="text-lg">⟳</span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* ===== Board ===== */}
        <div className="min-w-0 space-y-4 rounded-3xl border border-[#1E293B]/70 bg-[#080E1C]/55 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.22)] sm:p-3">
          <BoardGrid
            categoryIds={categoryIds}
            cells={cells}
            currentTurn={currentTurn}
            isCellPlayable={isCellPlayable}
            onSelectCell={handleSelectCell}
          />
        </div>

        {/* ===== Lifelines + shortcuts ===== */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-[#334155]/70 bg-gradient-to-b from-[#0D1728] to-[#090F1C] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.34)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[#D4A843]">{ui.lifelines}</h2>
              <span className="rounded-full border border-[#1E293B] bg-[#0F172A] px-2 py-1 text-xs text-gray-400">
                {currentTurn === 1 ? team1Name : team2Name}
              </span>
            </div>
            {!activeQuestion && (
              <LifelineList
                lifelines={currentLifelines}
                accent={currentTurn === 1 ? 'royal' : 'gold'}
                getDisabled={getLifelineDisabled}
                activeLifelineId={activeLifelineId}
                onSelect={handleUseLifeline}
              />
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-[#1E293B] bg-[#0B1220] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.3)]">
            <h2 className="text-lg font-bold text-[#D4A843]">{ui.shortcuts}</h2>
            <ul className="space-y-1 text-sm text-gray-400">
              <li><kbd className="rounded bg-[#1E293B] px-1.5 py-0.5 text-xs font-bold text-gray-300">Space</kbd> {ui.reveal}</li>
              <li><kbd className="rounded bg-[#1E293B] px-1.5 py-0.5 text-xs font-bold text-gray-300">C</kbd> إجابة صحيحة</li>
              <li><kbd className="rounded bg-[#1E293B] px-1.5 py-0.5 text-xs font-bold text-gray-300">W</kbd> إجابة خاطئة</li>
              <li><kbd className="rounded bg-[#1E293B] px-1.5 py-0.5 text-xs font-bold text-gray-300">R</kbd> تبديل الدور</li>
              <li><kbd className="rounded bg-[#1E293B] px-1.5 py-0.5 text-xs font-bold text-gray-300">Esc</kbd> إغلاق السؤال</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ===== Question modal ===== */}
      <AnimatePresence>
        {activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 20, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-5xl rounded-2xl border border-[#1E293B] bg-[#0B1220] p-5 shadow-2xl sm:p-6"
            >
              <div dir={direction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="order-1 min-w-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.25em] text-[#D4A843]">{ui.directQuestion}</p>
                  <h2 className="text-2xl font-black text-white">{activeCategory?.title ?? ui.category}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border-2 border-[#D4A843]/50 bg-[#D4A843]/10 px-3 py-1 text-sm font-black text-[#D4A843]">
                    {activeQuestion.doubleApplied ? activeQuestion.points * 2 : activeQuestion.points} نقطة
                  </div>
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ scale: countdown <= 5 ? [1, 1.18, 1] : 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      'rounded-full border-2 px-3 py-1 text-sm font-black tabular-nums',
                      countdown <= 5
                        ? 'border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444]'
                        : 'border-[#1E293B] bg-[#0F172A] text-gray-400',
                    )}
                  >
                    {countdown}s
                  </motion.div>
                </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-[#1E293B] bg-[#0F172A] p-4">
                <p className="mb-3 text-sm text-gray-400">الطوارئ: {activeQuestion.team === 1 ? team1Name : team2Name}</p>

                <AnimatePresence mode="wait">
                  {answerSubmitted ? (
                    <motion.div
                      key="submitted-answer"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3 py-4 text-center"
                    >
                      <div className={cn(
                        'text-xl font-black',
                        answerCorrect ? 'text-emerald-400' : 'text-[#FCA5A5]',
                      )}>
                        {answerCorrect ? ui.answerCorrect : ui.answerWrong}
                      </div>
                      <p className="text-lg font-bold text-white">
                        {ui.yourAnswer}: {selectedAnswer}
                      </p>
                      <p className="text-lg font-bold text-[#D4A843]">
                        {ui.correctAnswer}: {activeQuestion.answerText}
                      </p>
                      <p className="text-base font-black text-white">
                        +{answerPoints} نقطة
                      </p>
                    </motion.div>
                  ) : !isRevealed ? (
                    <motion.div
                      key="question"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {activeQuestion.mediaType === 'career' && activeQuestion.careerImage && (
                        <div className="mb-4">
                          <img
                            src={activeQuestion.careerImage}
                            alt="Career image"
                            className="mx-auto w-[320px] max-w-full rounded-xl object-contain"
                          />
                        </div>
                      )}
                      {activeQuestion.media && activeQuestion.mediaType === 'image' && (
                        <div className="mb-4">
                          <img src={activeQuestion.media} alt="Question media" className="mx-auto max-h-64 object-contain" />
                        </div>
                      )}
                      {activeQuestion.media && activeQuestion.mediaType === 'video' && (
                        <div className="mb-4">
                          <video
                            src={activeQuestion.media}
                            controls={false}
                            autoPlay
                            loop
                            muted
                            className="mx-auto max-h-64 w-full rounded-xl"
                          />
                        </div>
                      )}
                      {activeQuestion.categoryId !== 'who-scored' && (
                        <p className="text-lg leading-relaxed text-white">{activeQuestion.questionText}</p>
                      )}

                      {activeQuestion.answerOptions.length > 0 && (
                        <div className="mt-4 rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/10 p-3">
                          {activeQuestion.twoAnswersUsed && (
                            <div className="mb-3 text-center text-sm font-bold text-[#D4A843]">
                              {direction === 'ltr' ? 'Four answer choices enabled' : 'تم تفعيل اختيار أربع إجابات'}
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {activeQuestion.answerOptions.slice(0, 4).map((option, i) => (
                              <motion.button
                                key={`${option}-${i}`}
                                type="button"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                  if (answerSubmitted) return
                                  submitAnswer(option)
                                  const isCorrect = option === activeQuestion.answerText
                                  if (isCorrect) {
                                    const pts = activeQuestion.doubleApplied ? activeQuestion.points * 2 : activeQuestion.points
                                    setBurst({ team: activeQuestion.team, points: pts })
                                    window.setTimeout(() => setBurst(null), 1100)
                                  }
                                  playSound(isCorrect ? 'correct' : 'wrong')
                                }}
                                disabled={answerSubmitted}
                                className={cn(
                                  'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-start text-sm font-bold transition',
                                  answerSubmitted
                                    ? 'cursor-not-allowed border-gray-600/30 bg-gray-800/20 text-gray-500'
                                    : 'border-[#D4A843]/30 bg-[#D4A843]/5 text-[#D4A843] hover:border-[#D4A843]/60 hover:bg-[#D4A843]/15',
                                )}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4A843]/15 text-xs">
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span>{option}</span>
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="answer"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-center justify-center py-4"
                    >
                      {activeQuestion.categoryId === 'who-scored' && activeQuestion.answerMedia ? (
                        <>
                          <video
                            src={activeQuestion.answerMedia}
                            controls={false}
                            autoPlay
                            loop
                            muted
                            className="mx-auto max-h-64 w-full rounded-xl mb-4"
                          />
                          <p className="text-2xl font-bold text-white text-center">{activeQuestion.answerText}</p>
                        </>
                      ) : activeQuestion.answerMedia && (activeQuestion.mediaType === 'image' || activeQuestion.categoryId === 'world-cup-26') ? (
                        <>
                          <img
                            src={activeQuestion.answerMedia}
                            alt="Answer"
                            className="mx-auto max-h-64 max-w-full object-contain rounded-xl mb-4"
                          />
                          <p className="text-2xl font-bold text-white text-center">{activeQuestion.answerText}</p>
                        </>
                      ) : (
                        <>
                          {playerImageUrl && (
                            <img
                              src={playerImageUrl}
                              alt="Player"
                              className="mx-auto max-w-[220px] max-h-[260px] w-full rounded-xl object-contain object-center"
                            />
                          )}
                          <p className="mt-4 text-2xl font-bold text-white text-center">{activeQuestion.answerText}</p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {activeQuestion.hint && !isRevealed && (
                <div className="mt-4 rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/10 p-3 text-center">
                  <div className="text-sm font-bold text-[#D4A843]">
                    💡 تلميح
                  </div>
                  <div className="mt-1 text-gray-300">
                    {activeQuestion.hint}
                  </div>
                </div>
              )}


              {activeQuestion.doubleApplied && (
                <div className="mt-3 rounded-xl border border-[#D4A843]/40 bg-[#D4A843]/10 p-2 text-center text-sm font-bold text-[#D4A843]">
                  {direction === 'ltr' ? '✕2 Double points active' : '✕2 مضاعفة النقاط — النقاط مضاعفة'}
                </div>
              )}

              {blockActive && (
                <div className="mt-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-2 text-center text-sm font-bold text-[#FCA5A5]">
                  🛡️ {direction === 'ltr' ? 'Opponent blocked — ' : 'تم تفعيل حظر الخصم — الفريق '}{blockActive === 1 ? team1Name : team2Name}{direction === 'ltr' ? ' cannot answer this question' : ' لا يمكنه الإجابة على هذا السؤال'}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {!answerSubmitted && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRevealAnswer}
                    className="glass-button rounded-xl px-4 py-2 font-semibold text-white"
                  >
                    إظهار الإجابة
                  </motion.button>
                )}
                {answerSubmitted && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={finishSubmittedQuestion}
                    className="glass-button rounded-xl px-4 py-2 font-semibold text-white"
                  >
                    إنهاء السؤال
                  </motion.button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {isRevealed && !answerSubmitted && (
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
                      whileTap={blockActive !== 1 ? { scale: 0.97 } : undefined}
                      onClick={() => handleResolve(1)}
                      disabled={blockActive === 1}
                      className={cn(
                        'rounded-xl border-2 px-4 py-5 text-lg font-bold shadow-lg transition',
                        blockActive === 1
                          ? 'cursor-not-allowed border-gray-600/30 bg-gray-800/20 text-gray-500 shadow-none'
                          : 'border-[#3B82F6]/60 bg-[#3B82F6]/20 text-[#93C5FD] shadow-[#3B82F6]/10 hover:bg-[#3B82F6]/30',
                      )}
                    >
                      ✅ الفريق الأول أجاب صح
                      {blockActive === 1 && <span className="mt-1 block text-xs text-gray-500">محظور</span>}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={blockActive !== 2 ? { scale: 0.97 } : undefined}
                      onClick={() => handleResolve(2)}
                      disabled={blockActive === 2}
                      className={cn(
                        'rounded-xl border-2 px-4 py-5 text-lg font-bold shadow-lg transition',
                        blockActive === 2
                          ? 'cursor-not-allowed border-gray-600/30 bg-gray-800/20 text-gray-500 shadow-none'
                          : 'border-[#EF4444]/60 bg-[#EF4444]/20 text-[#FCA5A5] shadow-[#EF4444]/10 hover:bg-[#EF4444]/30',
                      )}
                    >
                      ✅ الفريق الثاني أجاب صح
                      {blockActive === 2 && <span className="mt-1 block text-xs text-gray-500">محظور</span>}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResolve(null)}
                      className="rounded-xl border-2 border-gray-600/40 bg-gray-700/20 px-4 py-5 text-lg font-bold text-gray-400 shadow-lg shadow-gray-600/10 hover:bg-gray-700/30"
                    >
                      ❌ لا أحد أجاب
                    </motion.button>
                  </motion.div>
                )}
                  </AnimatePresence>
                </div>

                <aside className="order-2 min-w-0 self-start rounded-xl border border-[#1E293B] bg-[#0F172A] p-3" dir={direction}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[#D4A843]">وسائل المساعدة</h3>
                    <span className="text-[10px] text-gray-500">{questionTeam === 1 ? team1Name : team2Name}</span>
                  </div>
                  {!isRevealed && (
                    <LifelineList
                      lifelines={currentLifelines.filter((lifeline) => ['double', 'wheel', 'call', 'block', 'two-answers'].includes(lifeline.id))}
                      accent={questionTeam === 1 ? 'royal' : 'gold'}
                      getDisabled={getLifelineDisabled}
                      activeLifelineId={activeLifelineId}
                      onSelect={handleUseLifeline}
                    />
                  )}
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-500">
                    يمكنك استخدام وسيلة مساعدة واحدة فقط في كل سؤال
                  </p>
                  {callFriendActive && callFriendTimeLeft > 0 && (
                    <div className="mt-3 rounded-lg border border-[#3B82F6]/40 bg-[#3B82F6]/10 p-2 text-center">
                      <div className="text-xs font-bold text-[#60A5FA]">📞 اتصال بصديق — {callFriendTimeLeft} ثانية</div>
                      <p className="mt-2 text-xs leading-relaxed text-gray-200">{callFriendHint}</p>
                      <button
                        type="button"
                        onClick={clearCallFriend}
                        className="mt-2 rounded-md border border-[#3B82F6]/40 px-2 py-1 text-[11px] font-bold text-[#93C5FD] hover:bg-[#3B82F6]/10"
                      >
                        إغلاق الاتصال
                      </button>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1E293B]">
                        <motion.div
                          initial={{ width: '100%' }}
                          animate={{ width: `${(callFriendTimeLeft / 30) * 100}%` }}
                          className="h-full rounded-full bg-[#3B82F6]"
                        />
                      </div>
                    </div>
                  )}
                </aside>
              </div>
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
              'pointer-events-none fixed bottom-6 end-6 z-[60] rounded-2xl border-2 px-4 py-3 text-lg font-black shadow-2xl',
              burst.team === 1
                ? 'border-[#3B82F6]/60 bg-[#3B82F6]/20 text-[#93C5FD] shadow-[#3B82F6]/30'
                : 'border-[#EF4444]/60 bg-[#EF4444]/20 text-[#FCA5A5] shadow-[#EF4444]/30',
            )}
          >
            +{burst.points}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wheelBonus && (
          <motion.div
            key={`wheel-${wheelBonus.teamId}-${wheelBonus.points}`}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={cn(
              'pointer-events-none fixed bottom-6 start-6 z-[60] rounded-2xl border-2 px-4 py-3 text-lg font-black shadow-2xl',
              wheelBonus.teamId === 1
                ? 'border-[#3B82F6]/60 bg-[#3B82F6]/20 text-[#93C5FD] shadow-[#3B82F6]/30'
                : 'border-[#EF4444]/60 bg-[#EF4444]/20 text-[#FCA5A5] shadow-[#EF4444]/30',
            )}
          >
            🎡 +{wheelBonus.points}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

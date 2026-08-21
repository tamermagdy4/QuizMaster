import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryBoard } from '../components/game-board/CategoryBoard'
import { GameBoardHeader } from '../components/game-board/GameBoardHeader'
import { LifelineList } from '../components/game-board/LifelineList'
import { WheelOfFortune } from '../components/game-board/WheelOfFortune'
import { POINT_SLOTS, type LifelineId } from '../types/board'
import type { TeamId } from '../types/game'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useAppStore } from '../store/appStore'
import { useOnlineStore } from '../store/onlineStore'
import { ensureLocalQuestionsLoaded, loadRemoteQuestions } from '../data/questionLoader'
import { getCategoryById } from '../utils/categories'
import { cn } from '../utils/cn'

type SoundType =
  | 'select'
  | 'reveal'
  | 'correct'
  | 'wrong'
  | 'turn'
  | 'timer'

type ResolveTone = 'success' | 'neutral' | null

function usePlayerImage(
  answerText: string | null,
  isRevealed: boolean,
) {
  const [playerImageUrl, setPlayerImageUrl] =
    useState<string | null>(null)

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

  const {
    direction,
    soundEnabled,
    setSoundEnabled,
    questionDuration,
    theme,
    animationsEnabled,
  } = useAppStore()

  const ui = useMemo(
    () =>
      direction === 'ltr'
        ? {
            currentTurn: 'Current turn',
            questionMode: 'Choose a question',
            directQuestion: 'Direct question',
            category: 'Category',
            points: 'points',
            team: 'Team',
            lifelines: 'Lifelines',
            shortcuts: 'Keyboard shortcuts',
            reveal: 'Reveal answer',
            finish: 'Finish question',
            answerCorrect: 'Correct answer',
            answerWrong: 'Wrong answer',
            yourAnswer: 'Your answer',
            correctAnswer: 'Correct answer',
            useOne: 'You can use one lifeline per question',
            double: 'Double points — choose a question',
            noAnswer: '❌ No one answered',
            teamAnswered: 'answered correctly',
            blocked: 'Blocked',
            call: 'Call a friend',
            closeCall: 'Close call',
            hint: 'Hint',
            resolveTeam1: '✅ Team 1 answered correctly',
            resolveTeam2: '✅ Team 2 answered correctly',
            resolveBlocked: 'Blocked',
          }
        : {
            currentTurn: 'الدور الحالي',
            questionMode: 'دوري — اختيار سؤال',
            directQuestion: 'سؤال مباشر',
            category: 'فئة',
            points: 'نقطة',
            team: 'الفريق',
            lifelines: 'المساعدات',
            shortcuts: 'اختصارات لوحة المفاتيح',
            reveal: 'إظهار الإجابة',
            finish: 'إنهاء السؤال',
            answerCorrect: 'إجابتك صحيحة! ✅',
            answerWrong: 'إجابتك خاطئة ❌',
            yourAnswer: 'إجابتك',
            correctAnswer: 'الإجابة الصحيحة',
            useOne: 'يمكنك استخدام وسيلة مساعدة واحدة فقط في كل سؤال',
            double: '✕2 مضاعفة النقاط — اختر سؤالاً',
            noAnswer: '❌ لا أحد أجاب',
            teamAnswered: 'أجاب صح',
            blocked: 'محظور',
            call: 'اتصال بصديق',
            closeCall: 'إغلاق الاتصال',
            hint: '💡 تلميح',
            resolveTeam1: '✅ الفريق الأول أجاب صح',
            resolveTeam2: '✅ الفريق الثاني أجاب صح',
            resolveBlocked: 'محظور',
          },
    [direction],
  )

  const {
    gameName,
    team1Name,
    team2Name,
    categoryIds,
    cells,
    currentTurn,
    team1Score,
    team2Score,
    ffaPlayers,
    ffaTurnPlayerId,
    team1Lifelines,
    team2Lifelines,
    activeQuestion,
    pendingDoublePoints,
    blockActive,
    callFriendActive,
    callFriendTimeLeft,
    callFriendHint,
    wheelBonus,
    wheelPending,
    applyWheelResult,
    closeWheel,
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
    gameMode,
    isRevealed,
    revealAnswer,
    hideAnswer,
    resetReveal,
    onlineAnswers,
    onlineAutoGrades,
    onlineFinalGrades,
    onlineGamePhase,
    submitOnlineAnswer,
    setOnlineFinalGrade,
    confirmOnlineReview,
  } = useGameBoardStore()

  const onlineStore = useOnlineStore()

  const audioContextRef = useRef<AudioContext | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const [countdown, setCountdown] =
    useState<number>(questionDuration)

  /** Online: the text the host/players type as their answer */
  const [onlineAnswerText, setOnlineAnswerText] = useState('')

  const [burst, setBurst] = useState<{
    team: TeamId
    points: number
  } | null>(null)

  const [resolveTone, setResolveTone] =
    useState<ResolveTone>(null)

  // The local question JSONs live in a module-level library that is only
  // populated by `ensureLocalQuestionsLoaded()`. That runs inside
  // `initializeBoard()` (CreateGame / online setup) — but the board route can
  // also be reached with a PERSISTED board (page refresh, direct URL, or
  // back/forward navigation), where `initializeBoard()` never runs and the
  // library would stay empty — every cell would report "no questions".
  // Kick the load off on mount so the library is populated on ANY entry path.
  const [questionsReady, setQuestionsReady] =
    useState(false)

  useEffect(() => {
    let mounted = true

    Promise.all([
      loadRemoteQuestions(),
      ensureLocalQuestionsLoaded(),
    ])
      .then(() => {
        if (mounted) setQuestionsReady(true)
      })
      .catch(() => {
        // If the load itself fails, keep the board usable — the question
        // selection flow reports the real state rather than hanging.
        if (mounted) setQuestionsReady(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Cleanup burst timer on unmount
  useEffect(() => {
    return () => {
      if (burstTimerRef.current) {
        window.clearTimeout(burstTimerRef.current)
      }
    }
  }, [])

  // Focus management: move focus into the modal when a question opens,
  // return focus to the trigger when it closes.
  useEffect(() => {
    if (activeQuestion) {
      // Defer to next frame so the DOM node is painted
      const raf = requestAnimationFrame(() => {
        modalRef.current?.focus()
      })
      return () => cancelAnimationFrame(raf)
    }
    // Restore focus to whichever button opened the modal
    triggerRef.current?.focus()
  }, [activeQuestion])

  const playerImageUrl = usePlayerImage(
    activeQuestion?.answerText || null,
    isRevealed,
  )

  const activeCategory = useMemo(
    () =>
      activeQuestion
        ? getCategoryById(activeQuestion.categoryId)
        : undefined,
    [activeQuestion],
  )

  /*
   * ============================
   * Sounds
   * ============================
   */

  const playSound = useCallback(
    (type: SoundType) => {
      if (
        !soundEnabled ||
        typeof window === 'undefined'
      ) {
        return
      }

      const AudioCtor =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext

      if (!AudioCtor) return

      const context =
        audioContextRef.current ??
        new AudioCtor()

      audioContextRef.current = context

      if (context.state === 'suspended') {
        void context.resume()
      }

      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type =
        type === 'wrong' || type === 'timer'
          ? 'sawtooth'
          : 'triangle'

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

      gain.gain.value =
        type === 'timer' ? 0.06 : 0.04

      oscillator.connect(gain)
      gain.connect(context.destination)

      oscillator.start()

      oscillator.stop(
        context.currentTime +
          (type === 'timer' ? 0.28 : 0.14),
      )
    },
    [soundEnabled],
  )

  /*
   * ============================
   * Resolve question
   * ============================
   */

  const handleResolve = useCallback(
    (winner: TeamId | null) => {
      if (!activeQuestion) return

      // LOCAL: an already-submitted answer is auto-judged on submit, so the
      // resolve buttons must never run again on it (double scoring).
      // ONLINE: submitting only RECORDS the answer — the host still judges it
      // here, so resolve must be allowed after answerSubmitted.
      if (
        answerSubmitted &&
        gameMode !== 'online'
      ) {
        return
      }

      // Online: only the HOST may judge answers. The store enforces this too,
      // but guard here as well so a non-host never sees burst/tone feedback.
      if (gameMode === 'online' && !onlineStore.isHost()) {
        return
      }

      const points = activeQuestion.points

      if (winner === 1 || winner === 2) {
        const displayPoints =
          activeQuestion.doubleApplied
            ? points * 2
            : points

        if (burstTimerRef.current) {
          window.clearTimeout(burstTimerRef.current)
        }

        setBurst({
          team: winner,
          points: displayPoints,
        })

        burstTimerRef.current = window.setTimeout(
          () => setBurst(null),
          1100,
        )
      }

      setResolveTone(
        winner === null
          ? 'neutral'
          : 'success',
      )

      resolveQuestion(winner)

      playSound(
        winner === null
          ? 'wrong'
          : 'correct',
      )
    },
    [
      activeQuestion,
      answerSubmitted,
      resolveQuestion,
      playSound,
      gameMode,
      onlineStore,
    ],
  )

  /*
   * ============================
   * Question timer
   * ============================
   */

  useEffect(() => {
    if (!activeQuestion) {
      resetReveal()
      setCountdown(questionDuration)
      setResolveTone(null)
      return
    }

    // Online: timer keeps running even after one player submits (simultaneous mode)
    if (gameMode !== 'online' && answerSubmitted) return

    resetReveal()
    setCountdown(questionDuration)
    setResolveTone(null)

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          playSound('timer')
          // ONLINE: do NOT reveal the correct answer — just lock inputs and
          // move to review phase. The host decides correctness.
          if (gameMode === 'online') {
            useGameBoardStore.setState({ onlineGamePhase: 'review' })
          } else {
            revealAnswer()
          }
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [
    activeQuestion,
    answerSubmitted,
    questionDuration,
    gameMode,
    resetReveal,
    revealAnswer,
    playSound,
  ])

  /*
   * ============================
   * Keyboard shortcuts
   * ============================
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === 'Escape' &&
        activeQuestion
      ) {
        hideAnswer()
      }

      if (event.key === '1') {
        event.preventDefault()

        if (
          activeQuestion &&
          blockActive !== 1
        ) {
          handleResolve(1)
        }
      }

      if (event.key === '2') {
        event.preventDefault()

        if (
          activeQuestion &&
          blockActive !== 2
        ) {
          handleResolve(2)
        }
      }

      if (event.key === '0') {
        event.preventDefault()

        if (activeQuestion) {
          handleResolve(null)
        }
      }

      if (
        event.code === 'Space' &&
        activeQuestion
      ) {
        event.preventDefault()
        // In online mode, Space should NOT reveal the answer — only the host decides.
        if (gameMode !== 'online') {
          revealAnswer()
          playSound('reveal')
        }
      }

      if (event.key.toLowerCase() === 'r') {
        switchTurn()
        playSound('turn')
      }

      if (
        event.key.toLowerCase() === 'c' &&
        activeQuestion
      ) {
        event.preventDefault()

        if (blockActive !== 1) {
          handleResolve(1)
        }
      }

      if (
        event.key.toLowerCase() === 'w' &&
        activeQuestion
      ) {
        event.preventDefault()
        handleResolve(null)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
  }, [
    activeQuestion,
    blockActive,
    handleResolve,
    playSound,
    switchTurn,
    revealAnswer,
    hideAnswer,
  ])

  /*
   * ============================
   * Select question
   * ============================
   */

  const handleSelectCell = useCallback(
    (
      categoryId: string,
      slotIndex: number,
    ) => {
      // Never query the question library before it has been populated — on a
      // rehydrated board the library may still be loading, and asking too
      // early would falsely report "no questions available".
      if (!questionsReady) return

      const question = selectQuestion(
        categoryId,
        slotIndex,
      )
      if (question) playSound('select')
    },
    [questionsReady, selectQuestion, playSound],
  )

  /*
   * ============================
   * Finish game automatically
   * ============================
   */

  useEffect(() => {
    if (!Array.isArray(cells) || cells.length === 0) return
    if (!Array.isArray(ffaPlayers)) return

    const isFfa = gameMode === 'online' && ffaPlayers.length >= 3

    let allUsed: boolean
    if (isFfa) {
      const totalCells = (categoryIds?.length ?? 0) * POINT_SLOTS.length
      allUsed = ffaPlayers.length >= 3 && ffaPlayers.every(
        (player) => Array.isArray(player.usedCells) && player.usedCells.length >= totalCells,
      )
    } else {
      allUsed = cells
        .flat()
        .every(
          (cell) =>
            cell.team1Played &&
            cell.team2Played,
        )
    }

    if (allUsed) {
      navigate('/results')
    }
  }, [cells, navigate, gameMode, ffaPlayers, categoryIds])

  /*
   * ============================
   * Reveal answer
   * ============================
   */

  const handleRevealAnswer = () => {
    if (
      !activeQuestion ||
      answerSubmitted
    ) {
      return
    }

    // In online mode, the host must NOT reveal the answer manually —
    // the answer is revealed only after the host makes a decision.
    if (gameMode === 'online') return

    revealAnswer()
    playSound('reveal')
  }

  /*
   * ============================
   * Call friend timer
   * ============================
   */

  useEffect(() => {
    if (
      !callFriendActive ||
      callFriendTimeLeft <= 0
    ) {
      return
    }

    const timer = window.setInterval(() => {
      tickCallFriend()
    }, 1000)

    return () =>
      window.clearInterval(timer)
  }, [
    callFriendActive,
    callFriendTimeLeft,
    tickCallFriend,
  ])

  /*
   * ============================
   * Wheel bonus
   * ============================
   */

  useEffect(() => {
    if (!wheelBonus) return

    const timeout = window.setTimeout(() => {
      useGameBoardStore.setState({
        wheelBonus: null,
      })
    }, 3000)

    return () =>
      window.clearTimeout(timeout)
  }, [wheelBonus])

  /*
   * ============================
   * Lifelines
   * ============================
   */

  const handleUseLifeline = useCallback(
    (lifelineId: string) => {
      const canUseBeforeQuestion =
        lifelineId === 'double' ||
        lifelineId === 'wheel'

      if (
        !canUseBeforeQuestion &&
        (!activeQuestion ||
          isRevealed ||
          activeQuestion.answered)
      ) {
        return
      }

      useLifeline(
        lifelineId as LifelineId,
      )

      playSound('select')
    },
    [
      activeQuestion,
      isRevealed,
      useLifeline,
      playSound,
    ],
  )

  const questionTeam =
    activeQuestion?.team ?? currentTurn

  const currentLifelines =
    questionTeam === 1
      ? team1Lifelines
      : team2Lifelines

  const getLifelineDisabled =
    useCallback(
      (lifelineId: string): boolean => {
        const lifeline =
          currentLifelines.find(
            (item) =>
              item.id === lifelineId,
          )

        if (!lifeline) return true

        if (lifeline.used) return true

        switch (lifelineId) {
          case 'double':
            if (
              pendingDoublePoints !== null
            ) {
              return true
            }

            if (
              isRevealed ||
              activeQuestion?.answered ||
              activeQuestion?.lifelineUsed
            ) {
              return true
            }

            return false

          case 'wheel':
            if (
              isRevealed ||
              activeQuestion?.answered ||
              activeQuestion?.lifelineUsed
            ) {
              return true
            }

            return false

          case 'two-answers':
            if (!activeQuestion)
              return true

            if (isRevealed)
              return true

            if (activeQuestion.answered)
              return true

            if (
              activeQuestion.twoAnswersUsed
            ) {
              return true
            }

            if (
              activeQuestion.lifelineUsed
            ) {
              return true
            }

            return false

          case 'block':
            if (!activeQuestion)
              return true

            if (isRevealed)
              return true

            if (activeQuestion.answered)
              return true

            if (blockActive)
              return true

            if (
              activeQuestion.lifelineUsed
            ) {
              return true
            }

            return false

          case 'call':
            if (!activeQuestion)
              return true

            if (isRevealed)
              return true

            if (activeQuestion.answered)
              return true

            if (
              activeQuestion.lifelineUsed
            ) {
              return true
            }

            return false

          default:
            return true
        }
      },
      [
        currentLifelines,
        pendingDoublePoints,
        activeQuestion,
        isRevealed,
        blockActive,
      ],
    )

  const activeLifelineId = useMemo(() => {
    if (
      pendingDoublePoints === currentTurn
    ) {
      return 'double'
    }

    if (
      blockActive &&
      blockActive !== currentTurn
    ) {
      return 'block'
    }

    if (
      callFriendActive === currentTurn
    ) {
      return 'call'
    }

    if (activeQuestion?.twoAnswersUsed) {
      return 'two-answers'
    }

    return null
  }, [
    pendingDoublePoints,
    blockActive,
    callFriendActive,
    activeQuestion,
    currentTurn,
  ])

  // Who may submit an answer for the current question. Local games: anyone
  // on the shared board. Online team mode: only the question's team (host =
  // team 1, joiner = team 2). Online FFA: only the question's owner.
  const canAnswer = useMemo(() => {
    if (gameMode !== 'online') return true
    if (!activeQuestion) return false
    // Online simultaneous mode: everyone (host + all players) can answer
    // ONLY during the answering phase. When review starts (timer=0), inputs lock.
    if (onlineGamePhase === 'answering') return true
    if (onlineGamePhase === 'review') return false
    // Legacy: only the team's turn may answer
    if (ffaPlayers.length >= 3) {
      return !!onlineStore.self && activeQuestion.playerId === onlineStore.self.id
    }
    const myTeam: TeamId = onlineStore.isHost() ? 1 : 2
    return activeQuestion.team === myTeam
  }, [gameMode, activeQuestion, ffaPlayers.length, onlineStore, onlineGamePhase])

  /*
   * ============================
   * Render
   * ============================
   */

  return (
    <div
      className={cn(
        `
          game-board-shell
          flex
          min-h-dvh
          flex-col
          gap-2
          rounded-2xl
          border
          p-2
          shadow-[0_24px_80px_rgba(0,0,0,0.28)]
          sm:gap-3
          sm:rounded-[28px]
          sm:p-3
          lg:gap-4
          lg:p-5

          landscape:max-md:min-h-[100dvh]
          landscape:max-md:gap-1
          landscape:max-md:rounded-none
          landscape:max-md:border-0
          landscape:max-md:p-1
        `,
        animationsEnabled && !prefersReducedMotion
          ? 'motion-enabled'
          : 'motion-reduced',
        theme === 'light'
          ? `
            theme-light-board
            border-slate-200
            bg-slate-100
            text-slate-800
          `
          : `
            border-white/[0.04]
            bg-[radial-gradient(circle_at_top,rgba(47,125,126,0.08),transparent_38%),radial-gradient(50%_30%_at_50%_110%,rgba(201,162,39,0.05),transparent_70%),#050816]
          `,
      )}
    >
      {/* Arena floor — perspective grid + vignette (decorative, never blocks) */}
      <div aria-hidden className="arena-grid pointer-events-none absolute inset-0 rounded-[28px] landscape:max-md:rounded-none" />

      {/* GAME HEADER — teams, identity, turn, help */}

      <GameBoardHeader
        isFfa={ffaPlayers.length >= 3}
        ffaPlayers={ffaPlayers}
        ffaTurnPlayerId={ffaTurnPlayerId}
        team1Name={team1Name}
        team2Name={team2Name}
        team1Score={team1Score}
        team2Score={team2Score}
        currentTurn={currentTurn}
        gameName={gameName}
        questionDuration={questionDuration}
        countdown={countdown}
        hasActiveQuestion={!!activeQuestion}
        soundEnabled={soundEnabled}
        onToggleSound={() =>
          setSoundEnabled(!soundEnabled)
        }
        onSwitchTurn={() => {
          switchTurn()
          playSound('turn')
        }}
        direction={direction}
        lifelines={currentLifelines}
        getLifelineDisabled={getLifelineDisabled}
        activeLifelineId={activeLifelineId}
        onUseLifeline={handleUseLifeline}
      />

      {/* PENDING DOUBLE — slim hint under the header */}

      {pendingDoublePoints === currentTurn && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#D4A843]/50 bg-[#D4A843]/15 px-3 py-1.5 text-[11px] font-black text-[#F5D98B] shadow-[0_0_14px_rgba(212,168,67,0.25)]"
        >
          <span className="text-xs" aria-hidden>✕2</span>
          {direction === 'ltr' ? 'Double points — pick a question' : 'مضاعفة النقاط — اختر سؤالاً'}
        </motion.div>
      )}

      {/* MAIN GAME AREA — the arena */}

      <div
        className="
          relative
          flex
          min-h-0
          min-w-0
          flex-1
          flex-col
          rounded-xl
          border
          border-[#D4A843]/25
          bg-[radial-gradient(80%_60%_at_50%_0%,rgba(47,125,126,0.1),transparent_60%),#080E1C]/60
          p-1.5
          shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_44px_rgba(0,0,0,0.35)]
          sm:rounded-3xl
          sm:p-3

          landscape:max-md:rounded-lg
          landscape:max-md:p-1
        "
      >
        {/* Stage corner brackets */}
        <span className="pointer-events-none absolute start-2 top-2 h-4 w-4 border-s-2 border-t-2 border-[#D4A843]/50" />
        <span className="pointer-events-none absolute end-2 top-2 h-4 w-4 border-e-2 border-t-2 border-[#D4A843]/50" />
        <span className="pointer-events-none absolute bottom-2 start-2 h-4 w-4 border-b-2 border-s-2 border-[#D4A843]/50" />
        <span className="pointer-events-none absolute bottom-2 end-2 h-4 w-4 border-b-2 border-e-2 border-[#D4A843]/50" />

        {/* Questions still streaming in — brief, only on rehydrated boards */}
        {!questionsReady && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[#050a12]/80">
            <span className="rounded-full border border-petro-line bg-[#0d1b2a]/90 px-4 py-2 text-xs font-bold text-teal-bright shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              جارٍ تحميل الأسئلة…
            </span>
          </div>
        )}

        <CategoryBoard
          categoryIds={categoryIds}
          cells={cells}
          currentTurn={currentTurn}
          isCellPlayable={isCellPlayable}
          onSelectCell={handleSelectCell}
        />
      </div>

      {/* QUESTION MODAL */}

      <AnimatePresence>
        {activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={ui.directQuestion}
            tabIndex={-1}
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/88
              p-2

              sm:p-4

              landscape:max-md:p-1
            "
          >
            <motion.div
              /*
               * Shared element with the selected category tile (same
               * layoutId): the card grows out of the tile, so the board
               * travels to the question. Position/size come from the layout
               * projection; only opacity is animated here.
               */
              layoutId={`question-card-${activeQuestion.categoryId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="
                flex
                w-full
                max-w-4xl
                max-h-[95dvh]
                flex-col
                overflow-hidden
                rounded-xl
                border
                border-[#1E293B]
                bg-[#0B1220]
                p-3
                shadow-2xl

                sm:rounded-2xl
                sm:p-5

                landscape:max-md:max-w-[98vw]
                landscape:max-md:max-h-[98dvh]
                landscape:max-md:rounded-lg
                landscape:max-md:p-2
              "
            >
              <div
                dir={direction}
                className="
                  grid
                  min-h-0
                  grid-cols-1
                  gap-2
                  overflow-y-auto
                  overscroll-contain
                  pe-1
                  sm:gap-3
                  lg:grid-cols-[minmax(0,1fr)_200px]

                  landscape:max-md:grid-cols-[minmax(0,1fr)_150px]
                  landscape:max-md:gap-2
                  landscape:max-md:max-h-[96dvh]
                "
              >
                {/* QUESTION CONTENT */}

                <div className="order-1 min-w-0">
                  <div
                    className="
                      mb-2
                      flex
                      items-center
                      justify-between
                      gap-2

                      sm:mb-3
                      sm:gap-3

                      landscape:max-md:mb-1
                      landscape:max-md:gap-1
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          font-bold
                          tracking-[0.25em]
                          text-[#D4A843]

                          landscape:max-md:text-[7px]
                        "
                      >
                        {ui.directQuestion}
                      </p>

                      <h2
                        className="
                          text-2xl
                          font-black
                          text-white

                          landscape:max-md:text-sm
                        "
                      >
                        {activeCategory?.title ??
                          ui.category}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 landscape:max-md:gap-1">
                      <div
                        className={cn(
                          'rounded-full border-2 px-3 py-1 text-sm font-black shadow-[0_0_16px_rgba(0,0,0,0.25)] landscape:max-md:border landscape:max-md:px-1.5 landscape:max-md:py-0.5 landscape:max-md:text-[9px]',
                          activeQuestion.points <= 100
                            ? 'border-[#3b82f6]/60 bg-[#3b82f6]/12 text-[#93c5fd]'
                            : activeQuestion.points <= 300
                              ? 'border-[#22c55e]/60 bg-[#22c55e]/12 text-[#86efac]'
                              : 'border-[#ef4444]/60 bg-[#ef4444]/12 text-[#fca5a5]',
                        )}
                      >
                        {activeQuestion.doubleApplied
                          ? activeQuestion.points *
                            2
                          : activeQuestion.points}{' '}
                        نقطة
                      </div>

                      <motion.div
                        key={countdown}
                        initial={{
                          scale: 0.9,
                          opacity: 0.7,
                        }}
                        animate={{
                          scale:
                            countdown <= 5
                              ? [1, 1.18, 1]
                              : 1,
                          opacity: 1,
                        }}
                        transition={{
                          duration: 0.25,
                        }}
                        className={cn(
                          `
                            rounded-full
                            border-2
                            px-3
                            py-1
                            text-sm
                            font-black
                            tabular-nums

                            landscape:max-md:border
                            landscape:max-md:px-1.5
                            landscape:max-md:py-0.5
                            landscape:max-md:text-[9px]
                          `,
                          countdown <= 5
                            ? `
                              border-[#EF4444]
                              bg-[#EF4444]/10
                              text-[#EF4444]
                            `
                            : `
                              border-[#1E293B]
                              bg-[#0F172A]
                              text-gray-400
                            `,
                        )}
                      >
                        {countdown}s
                      </motion.div>
                    </div>
                  </div>

                  <div
                    className="
                      mb-2
                      rounded-xl
                      border
                      border-[#1E293B]
                      bg-[#0F172A]
                      p-2

                      sm:mb-3
                      sm:p-3

                      landscape:max-md:mb-1
                      landscape:max-md:rounded-lg
                      landscape:max-md:p-2
                    "
                  >
                    <p
                      className="
                        mb-3
                        text-sm
                        text-gray-400

                        landscape:max-md:mb-1
                        landscape:max-md:text-[8px]
                      "
                    >
                      الطوارئ:{' '}
                      {activeQuestion.team === 1
                        ? team1Name
                        : team2Name}
                    </p>

                    <AnimatePresence mode="wait">
                      {answerSubmitted ? (
                        <motion.div
                          key="submitted-answer"
                          initial={{
                            opacity: 0,
                            y: 8,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          className="
                            space-y-2
                            py-2
                            text-center

                            landscape:max-md:space-y-1
                            landscape:max-md:py-1
                          "
                        >
                          {gameMode === 'online' &&
                          answerCorrect === null ? (
                            /*
                             * ONLINE: the answer was submitted but the HOST has
                             * NOT judged it yet. The host (the controller) sees
                             * the submitted answer and decides correct/wrong
                             * (buttons below). The other players only see that
                             * an answer is waiting — and never the correct
                             * answer text before the host's decision.
                             */
                            <>
                              {onlineStore.isHost() ? (
                                <>
                                  <div className="text-xl font-black text-[#F5D98B] landscape:max-md:text-sm">
                                    {direction === 'ltr'
                                      ? 'Submitted answer — judge it'
                                      : 'إجابة مُرسلة — قيّمها'}
                                  </div>
                                  <div className="max-h-[18dvh] min-h-0 overflow-y-auto overscroll-contain px-1">
                                    <p className="text-lg font-bold text-white landscape:max-md:text-[10px]">
                                      {ui.yourAnswer}:{' '}
                                      {selectedAnswer || (direction === 'ltr' ? 'No answer' : 'لم يجب')}
                                    </p>
                                    <p className="text-lg font-bold text-[#D4A843] landscape:max-md:text-[10px]">
                                      {ui.correctAnswer}:{' '}
                                      {
                                        activeQuestion.answerText
                                      }
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-lg font-bold text-white landscape:max-md:text-[10px]">
                                    {ui.yourAnswer}:{' '}
                                    {selectedAnswer || (direction === 'ltr' ? 'No answer' : 'لم يجب')}
                                  </div>
                                  <div className="text-base font-black text-[#D4A843] landscape:max-md:text-[10px]">
                                    {direction === 'ltr'
                                      ? 'Waiting for the host…'
                                      : 'بانتظار قرار المضيف…'}
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  `
                                    text-xl
                                    font-black

                                    landscape:max-md:text-sm
                                  `,
                                  answerCorrect
                                    ? 'text-emerald-400'
                                    : 'text-[#FCA5A5]',
                                )}
                              >
                                {answerCorrect
                                  ? ui.answerCorrect
                                  : ui.answerWrong}
                              </div>

                              <div                              className="
                                max-h-[18dvh]
                                min-h-0
                                overflow-y-auto
                                overscroll-contain
                                px-1
                              "
                              >
                                <p
                                  className="
                                    text-lg
                                    font-bold
                                    text-white

                                    landscape:max-md:text-[10px]
                                  "
                                >
                                  {ui.yourAnswer}:{' '}
                                  {selectedAnswer}
                                </p>

                                <p
                                  className="
                                    text-lg
                                    font-bold
                                    text-[#D4A843]

                                    landscape:max-md:text-[10px]
                                  "
                                >
                                  {ui.correctAnswer}:{' '}
                                  {
                                    activeQuestion.answerText
                                  }
                                </p>
                              </div>

                              <p
                                className="
                                  text-base
                                  font-black
                                  text-white

                                  landscape:max-md:text-[10px]
                                "
                              >
                                +{answerPoints} نقطة
                              </p>
                            </>
                          )}
                        </motion.div>
                      ) : gameMode === 'online' && onlineGamePhase === 'review' && !answerSubmitted && !onlineStore.isHost() ? (
                        /* Timer expired and player did NOT answer — show timeout (NOT for host) */
                        <motion.div
                          key="timeout"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-6 text-center"
                        >
                          <span className="text-4xl mb-3">⏰</span>
                          <p className="text-lg font-black text-red-400">
                            {direction === 'ltr' ? 'Time is up!' : 'انتهى الوقت!'}
                          </p>
                          <p className="mt-2 text-sm font-bold text-[#D4A843]">
                            {direction === 'ltr'
                              ? 'Waiting for the host…'
                              : 'بانتظار قرار المضيف…'}
                          </p>
                        </motion.div>
                      ) : !isRevealed ? (
                        <motion.div
                          key="question"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.3,
                          }}
                        >
                          {activeQuestion.mediaType ===
                            'career' &&
                            activeQuestion.careerImage && (
                              <div className="mb-4 landscape:max-md:mb-1">
                                <img
                                  src={
                                    activeQuestion.careerImage
                                  }
                                  alt="Career image"
                                  className="
                                    mx-auto
                                    w-[280px]
                                    max-w-full
                                    rounded-xl
                                    object-contain

                                    landscape:max-md:max-h-[90px]
                                    landscape:max-md:w-auto
                                  "
                                />
                              </div>
                            )}

                          {activeQuestion.media &&
                            activeQuestion.mediaType ===
                              'image' && (
                              <div className="mb-4 landscape:max-md:mb-1">
                                <img
                                  src={
                                    activeQuestion.media
                                  }
                                  alt="Question media"
                                  className="
                                    mx-auto
                                    max-h-48
                                    max-w-full
                                    object-contain

                                    landscape:max-md:max-h-[110px]
                                  "
                                />
                              </div>
                            )}

                          {activeQuestion.media &&
                            activeQuestion.mediaType ===
                              'video' && (
                              <div className="mb-4 landscape:max-md:mb-1">
                                <video
                                  src={
                                    activeQuestion.media
                                  }
                                  controls={false}
                                  autoPlay
                                  loop
                                  muted
                                  className="
                                    mx-auto
                                    max-h-48
                                    w-full
                                    rounded-xl

                                    landscape:max-md:max-h-[110px]
                                  "
                                />
                              </div>
                            )}

                          {activeQuestion.categoryId !==
                            'who-scored' && (
                            <div
                              className="
                                max-h-[25dvh]
                                min-h-0
                                overflow-y-auto
                                overscroll-contain
                                pe-1

                                sm:max-h-[30dvh]
                              "
                            >
                              <p
                                className="
                                  text-sm
                                  leading-relaxed
                                  text-white

                                  sm:text-lg

                                  landscape:max-md:text-xs
                                  landscape:max-md:leading-relaxed
                                "
                              >
                                {
                                  activeQuestion.questionText
                                }
                              </p>
                            </div>
                          )}

                          {/* ONLINE TEXT INPUT — host + all players type their answer */}
                          {gameMode === 'online' && canAnswer && !answerSubmitted && (
                            <div className="mt-3">
                              <input
                                type="text"
                                value={onlineAnswerText}
                                onChange={(e) => setOnlineAnswerText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && onlineAnswerText.trim()) {
                                    e.preventDefault()
                                    submitAnswer(onlineAnswerText.trim())
                                    if (onlineStore.self) {
                                      submitOnlineAnswer(onlineStore.self.id, onlineStore.self.name, onlineAnswerText.trim())
                                    }
                                    setOnlineAnswerText('')
                                    playSound('select')
                                  }
                                }}
                                placeholder={direction === 'ltr' ? 'Type your answer...' : 'اكتب إجابتك...'}
                                className="w-full rounded-xl border-2 border-[#D4A843]/40 bg-[#0B1220] px-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none transition focus:border-[#D4A843]/70 focus:ring-1 focus:ring-[#D4A843]/30"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={!onlineAnswerText.trim()}
                                onClick={() => {
                                  if (onlineAnswerText.trim()) {
                                    submitAnswer(onlineAnswerText.trim())
                                    if (onlineStore.self) {
                                      submitOnlineAnswer(onlineStore.self.id, onlineStore.self.name, onlineAnswerText.trim())
                                    }
                                    setOnlineAnswerText('')
                                    playSound('select')
                                  }
                                }}
                                className="mt-2 w-full rounded-xl bg-[#D4A843] px-4 py-2.5 text-sm font-black text-[#0B1220] shadow-lg transition hover:bg-[#E0B84D] disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {direction === 'ltr' ? 'Submit Answer' : 'إرسال الإجابة'}
                              </button>
                            </div>
                          )}

                          {/* ANSWER OPTIONS */}

                          {activeQuestion.answerOptions
                            .length > 0 && (
                            <div
                              className="
                                mt-2
                                rounded-xl
                                border
                                border-[#D4A843]/30
                                bg-[#D4A843]/10
                                p-2

                                sm:mt-3
                                sm:p-3

                                landscape:max-md:mt-1
                                landscape:max-md:rounded-lg
                                landscape:max-md:p-1.5
                              "
                            >
                              {activeQuestion.twoAnswersUsed && (
                                <div
                                  className="
                                    mb-3
                                    text-center
                                    text-sm
                                    font-bold
                                    text-[#D4A843]

                                    landscape:max-md:mb-1
                                    landscape:max-md:text-[8px]
                                  "
                                >
                                  {direction === 'ltr'
                                    ? 'Four answer choices enabled'
                                    : 'تم تفعيل اختيار أربع إجابات'}
                                </div>
                              )}

                              <div
                                className="
                                  grid
                                  grid-cols-1
                                  gap-1.5
                                  sm:grid-cols-2
                                  sm:gap-2

                                  landscape:max-md:grid-cols-2
                                  landscape:max-md:gap-1
                                "
                              >
                                {activeQuestion.answerOptions
                                  .slice(0, 4)
                                  .map(
                                    (
                                      option,
                                      i,
                                    ) => (
                                      <motion.button
                                        key={`${option}-${i}`}
                                        type="button"
                                        initial={{
                                          opacity: 0,
                                          y: 8,
                                        }}
                                        animate={{
                                          opacity: 1,
                                          y: 0,
                                        }}
                                        transition={{
                                          delay:
                                            i * 0.05,
                                        }}
                                        whileTap={{
                                          scale: 0.97,
                                        }}
                                        onClick={() => {
                                          if (
                                            answerSubmitted ||
                                            !canAnswer
                                          ) {
                                            return
                                          }

                                          submitAnswer(
                                            option,
                                          )

                                          // ONLINE: record in the simultaneous answers map
                                          if (
                                            gameMode === 'online' &&
                                            onlineStore.self
                                          ) {
                                            submitOnlineAnswer(
                                              onlineStore.self.id,
                                              onlineStore.self.name,
                                              option,
                                            )
                                            playSound('select')
                                            return
                                          }

                                          const isCorrect =
                                            option ===
                                            activeQuestion.answerText

                                          if (
                                            isCorrect
                                          ) {
                                            const pts =
                                              activeQuestion.doubleApplied
                                                ? activeQuestion.points *
                                                  2
                                                : activeQuestion.points

                                            if (burstTimerRef.current) {
                                              window.clearTimeout(burstTimerRef.current)
                                            }

                                            setBurst({
                                              team: activeQuestion.team,
                                              points:
                                                pts,
                                            })

                                            burstTimerRef.current = window.setTimeout(
                                              () =>
                                                setBurst(
                                                  null,
                                                ),
                                              1100,
                                            )
                                          }

                                          playSound(
                                            isCorrect
                                              ? 'correct'
                                              : 'wrong',
                                          )
                                        }}
                                        disabled={
                                          answerSubmitted ||
                                          !canAnswer
                                        }
                                        aria-label={`${String.fromCharCode(65 + i)}: ${option}`}
                                        className={cn(
                                          `
                                            flex
                                            items-center
                                            gap-2
                                            rounded-xl
                                            border-2
                                            px-3
                                            py-2.5
                                            text-start
                                            text-sm
                                            font-bold
                                            transition

                                            sm:gap-2
                                            sm:py-3

                                            landscape:max-md:gap-1
                                            landscape:max-md:rounded-lg
                                            landscape:max-md:border
                                            landscape:max-md:px-1.5
                                            landscape:max-md:py-1.5
                                            landscape:max-md:text-[9px]
                                          `,
                                          answerSubmitted
                                            ? `
                                              cursor-not-allowed
                                              border-gray-600/30
                                              bg-gray-800/20
                                              text-gray-500
                                            `
                                            : `
                                              border-[#D4A843]/30
                                              bg-[#D4A843]/5
                                              text-[#D4A843]
                                              hover:border-[#D4A843]/60
                                              hover:bg-[#D4A843]/15
                                            `,
                                        )}
                                      >
                                        <span
                                          className="
                                            flex
                                            h-7
                                            w-7
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-full
                                            bg-[#D4A843]/15
                                            text-xs

                                            landscape:max-md:h-4
                                            landscape:max-md:w-4
                                            landscape:max-md:text-[7px]
                                          "
                                        >
                                          {String.fromCharCode(
                                            65 + i,
                                          )}
                                        </span>

                                        <span>
                                          {option}
                                        </span>
                                      </motion.button>
                                    ),
                                  )}
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
                          transition={{
                            duration: 0.3,
                          }}
                          className="
                            flex
                            flex-col
                            items-center
                            justify-center
                            py-2

                            sm:py-4

                            landscape:max-md:py-1
                          "
                        >
                          {activeQuestion.categoryId ===
                            'who-scored' &&
                          activeQuestion.answerMedia ? (
                            <>
                              <video
                                src={
                                  activeQuestion.answerMedia
                                }
                                controls={false}
                                autoPlay
                                loop
                                muted
                                className="
                                  mx-auto
                                  mb-3
                                  max-h-48
                                  w-full
                                  rounded-xl

                                  landscape:max-md:mb-1
                                  landscape:max-md:max-h-[100px]
                                "
                              />

                              <div
                                className="
                                  max-h-[24dvh]
                                  min-h-0
                                  overflow-y-auto
                                  overscroll-contain
                                  px-1
                                "
                              >
                                <p
                                  className="
                                    text-center
                                    text-xl
                                    font-bold
                                    text-white

                                    landscape:max-md:text-sm
                                  "
                                >
                                  {
                                    activeQuestion.answerText
                                  }
                                </p>
                              </div>
                            </>
                          ) : activeQuestion.answerMedia &&
                            (activeQuestion.mediaType ===
                              'image' ||
                              activeQuestion.categoryId ===
                                'world-cup-26') ? (
                            <>
                              <img
                                src={
                                  activeQuestion.answerMedia
                                }
                                alt="Answer"
                                className="
                                  mx-auto
                                  mb-3
                                  max-h-48
                                  max-w-full
                                  rounded-xl
                                  object-contain

                                  landscape:max-md:mb-1
                                  landscape:max-md:max-h-[100px]
                                "
                              />

                              <div
                                className="
                                  max-h-[24dvh]
                                  min-h-0
                                  overflow-y-auto
                                  overscroll-contain
                                  px-1
                                "
                              >
                                <p
                                  className="
                                    text-center
                                    text-xl
                                    font-bold
                                    text-white

                                    landscape:max-md:text-sm
                                  "
                                >
                                  {
                                    activeQuestion.answerText
                                  }
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              {playerImageUrl && (
                                <img
                                  src={
                                    playerImageUrl
                                  }
                                  alt="Player"
                                  className="
                                    mx-auto
                                    max-h-[200px]
                                    w-full
                                    max-w-[180px]
                                    rounded-xl
                                    object-contain
                                    object-center

                                    landscape:max-md:max-h-[100px]
                                    landscape:max-md:max-w-[100px]
                                  "
                                />
                              )}

                              <div
                                className="
                                  mt-3
                                  max-h-[24dvh]
                                  min-h-0
                                  overflow-y-auto
                                  overscroll-contain
                                  px-1
                                "
                              >
                                <p
                                  className="
                                    text-center
                                    text-2xl
                                    font-bold
                                    text-white

                                    landscape:max-md:text-sm
                                  "
                                >
                                  {
                                    activeQuestion.answerText
                                  }
                                </p>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* HINT */}

                  {activeQuestion.hint &&
                    !isRevealed && (
                      <div
                        className="
                          mt-2
                          rounded-xl
                          border
                          border-[#D4A843]/30
                          bg-[#D4A843]/10
                          p-2
                          text-center

                          sm:mt-3
                          sm:p-2.5

                          landscape:max-md:mt-1
                          landscape:max-md:rounded-lg
                          landscape:max-md:p-1
                        "
                      >
                        <div
                          className="
                            text-xs
                            font-bold
                            text-[#D4A843]

                            sm:text-sm

                            landscape:max-md:text-[8px]
                          "
                        >
                          💡 تلميح
                        </div>

                        <div
                          className="
                            mt-1
                            text-gray-300

                            text-[11px]

                            sm:text-sm

                            landscape:max-md:mt-0
                            landscape:max-md:text-[8px]
                          "
                        >
                          {activeQuestion.hint}
                        </div>
                      </div>
                    )}

                  {/* DOUBLE */}

                  {activeQuestion.doubleApplied && (
                    <div
                      className="
                        mt-2
                        rounded-xl
                        border
                        border-[#D4A843]/40
                        bg-[#D4A843]/10
                        p-1.5
                        text-center
                        text-xs
                        font-bold
                        text-[#D4A843]

                        sm:mt-3
                        sm:p-2
                        sm:text-sm

                        landscape:max-md:mt-1
                        landscape:max-md:p-1
                        landscape:max-md:text-[8px]
                      "
                    >
                      {direction === 'ltr'
                        ? '✕2 Double points active'
                        : '✕2 مضاعفة النقاط — النقاط مضاعفة'}
                    </div>
                  )}

                  {/* BLOCK */}

                  {blockActive && (
                    <div
                      className="
                        mt-2
                        rounded-xl
                        border
                        border-[#EF4444]/40
                        bg-[#EF4444]/10
                        p-1.5
                        text-center
                        text-xs
                        font-bold
                        text-[#FCA5A5]

                        sm:mt-3
                        sm:p-2
                        sm:text-sm

                        landscape:max-md:mt-1
                        landscape:max-md:p-1
                        landscape:max-md:text-[8px]
                      "
                    >
                      🛡️{' '}
                      {direction === 'ltr'
                        ? 'Opponent blocked — '
                        : 'تم تفعيل حظر الخصم — الفريق '}

                      {blockActive === 1
                        ? team1Name
                        : team2Name}

                      {direction === 'ltr'
                        ? ' cannot answer this question'
                        : ' لا يمكنه الإجابة على هذا السؤال'}
                    </div>
                  )}

                  {/* REVEAL / FINISH */}

                  <div
                    className="
                      flex
                      flex-wrap
                      gap-1.5

                      sm:gap-2

                      landscape:max-md:gap-1
                    "
                  >
                    {/* Reveal button — LOCAL only. Online auto-reveals at timer=0. */}
                    {!answerSubmitted && gameMode !== 'online' && (
                      <motion.button
                        type="button"
                        ref={triggerRef}
                        whileTap={{
                          scale: 0.97,
                        }}
                        onClick={
                          handleRevealAnswer
                        }
                        aria-label={ui.reveal}
                        className="
                          glass-button
                          rounded-xl
                          px-4
                          py-2
                          font-semibold
                          text-white

                          max-[640px]:rounded-lg
                          max-[640px]:px-2.5
                          max-[640px]:py-1.5
                          max-[640px]:text-[11px]

                          landscape:max-md:rounded-lg
                          landscape:max-md:px-2
                          landscape:max-md:py-1
                          landscape:max-md:text-[9px]
                        "
                      >
                        إظهار الإجابة
                      </motion.button>
                    )}

                    {/*
                     * LOCAL: the answer was auto-judged on submit — the host
                     * just finishes the question (unchanged behavior).
                     * ONLINE: submitting only RECORDS the answer — the HOST
                     * judges it here with صحيحة / خاطئة, which applies the
                     * existing scoring (resolveQuestion is host-gated) and
                     * finishes the question + advances the turn.
                     */}
                    {answerSubmitted && gameMode !== 'online' && (
                      <motion.button
                        type="button"
                        whileTap={{
                          scale: 0.97,
                        }}
                        onClick={
                          finishSubmittedQuestion
                        }
                        className="
                          glass-button
                          rounded-xl
                          px-4
                          py-2
                          font-semibold
                          text-white

                          max-[640px]:rounded-lg
                          max-[640px]:px-2.5
                          max-[640px]:py-1.5
                          max-[640px]:text-[11px]

                          landscape:max-md:rounded-lg
                          landscape:max-md:px-2
                          landscape:max-md:py-1
                          landscape:max-md:text-[9px]
                        "
                      >
                        إنهاء السؤال
                      </motion.button>
                    )}

                    {/* Online review panel: auto-graded answers + host override + Next Question */}
                    {gameMode === 'online' && onlineStore.isHost() && onlineGamePhase === 'review' && (
                      <OnlineReviewPanel
                        onlineAnswers={onlineAnswers}
                        onlineAutoGrades={onlineAutoGrades}
                        onlineFinalGrades={onlineFinalGrades}
                        onlineGamePhase={onlineGamePhase}
                        correctAnswer={activeQuestion.answerText}
                        players={onlineStore.players}
                        onOverrideGrade={setOnlineFinalGrade}
                        onConfirmReview={() => {
                          confirmOnlineReview()
                          // Delay closing the question so players can see the result.
                          // After 3 seconds, finish the question like local mode.
                          setTimeout(() => {
                            handleResolve(activeQuestion.team)
                          }, 3000)
                        }}
                        direction={direction}
                      />
                    )}
                  </div>

                  {/* RESOLVE BUTTONS */}

                  <AnimatePresence mode="wait">
                    {isRevealed &&
                      !answerSubmitted &&
                      (gameMode !== 'online' || onlineStore.isHost()) && (
                        <motion.div
                          key="choices"
                          initial={{
                            opacity: 0,
                            y: 12,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          exit={{
                            opacity: 0,
                            y: -10,
                          }}                          className={cn(
                            `
                              mt-2
                              grid
                              grid-cols-3
                              gap-1.5
                              max-[640px]:gap-1
                              sm:mt-3
                              sm:gap-3

                              landscape:max-md:mt-1
                              landscape:max-md:gap-1
                            `,
                            resolveTone ===
                              'success' &&
                              'animate-pulse',
                          )}
                        >
                          {/* TEAM 1 */}

                          <motion.button
                            type="button"
                            whileTap={
                              blockActive !== 1
                                ? {
                                    scale: 0.97,
                                  }
                                : undefined
                            }
                            onClick={() =>
                              handleResolve(1)
                            }
                            disabled={
                              blockActive === 1
                            }
                            aria-label={direction === 'ltr' ? 'Team 1 answered correctly' : 'الفريق الأول أجاب صح'}
                            className={cn(
                              `
                                rounded-xl
                                border-2
                                px-2
                                py-3
                                text-xs
                                font-bold
                                shadow-lg
                                transition

                                max-[640px]:rounded-lg
                                max-[640px]:border
                                max-[640px]:px-1.5
                                max-[640px]:py-2
                                max-[640px]:text-[10px]

                                sm:px-4
                                sm:py-5
                                sm:text-lg

                                landscape:max-md:rounded-lg
                                landscape:max-md:border
                                landscape:max-md:px-1
                                landscape:max-md:py-2
                                landscape:max-md:text-[8px]
                              `,
                              blockActive === 1
                                ? `
                                  cursor-not-allowed
                                  border-gray-600/30
                                  bg-gray-800/20
                                  text-gray-500
                                  shadow-none
                                `
                                : `
                                  border-[#3B82F6]/60
                                  bg-[#3B82F6]/20
                                  text-[#93C5FD]
                                  shadow-[#3B82F6]/10
                                  hover:bg-[#3B82F6]/30
                                `,
                            )}
                          >
                            {ui.resolveTeam1}

                            {blockActive === 1 && (
                              <span className="mt-1 block text-xs text-gray-500 landscape:max-md:text-[6px]">
                                {ui.resolveBlocked}
                              </span>
                            )}
                          </motion.button>

                          {/* TEAM 2 */}

                          <motion.button
                            type="button"
                            whileTap={
                              blockActive !== 2
                                ? {
                                    scale: 0.97,
                                  }
                                : undefined
                            }
                            onClick={() =>
                              handleResolve(2)
                            }
                            disabled={
                              blockActive === 2
                            }
                            aria-label={direction === 'ltr' ? 'Team 2 answered correctly' : 'الفريق الثاني أجاب صح'}
                            className={cn(
                              `
                                rounded-xl
                                border-2
                                px-2
                                py-3
                                text-xs
                                font-bold
                                shadow-lg
                                transition

                                max-[640px]:rounded-lg
                                max-[640px]:border
                                max-[640px]:px-1.5
                                max-[640px]:py-2
                                max-[640px]:text-[10px]

                                sm:px-4
                                sm:py-5
                                sm:text-lg

                                landscape:max-md:rounded-lg
                                landscape:max-md:border
                                landscape:max-md:px-1
                                landscape:max-md:py-2
                                landscape:max-md:text-[8px]
                              `,
                              blockActive === 2
                                ? `
                                  cursor-not-allowed
                                  border-gray-600/30
                                  bg-gray-800/20
                                  text-gray-500
                                  shadow-none
                                `
                                : `
                                  border-[#EF4444]/60
                                  bg-[#EF4444]/20
                                  text-[#FCA5A5]
                                  shadow-[#EF4444]/10
                                  hover:bg-[#EF4444]/30
                                `,
                            )}
                          >
                            {ui.resolveTeam2}

                            {blockActive === 2 && (
                              <span className="mt-1 block text-xs text-gray-500 landscape:max-md:text-[6px]">
                                {ui.resolveBlocked}
                              </span>
                            )}
                          </motion.button>

                          {/* NO ONE */}

                          <motion.button
                            type="button"
                            whileTap={{
                              scale: 0.97,
                            }}
                            onClick={() =>
                              handleResolve(null)
                            }
                            aria-label={direction === 'ltr' ? 'No one answered' : 'لا أحد أجاب'}
                            className="
                              rounded-xl
                              border-2
                              border-gray-600/40
                              bg-gray-700/20
                              px-2
                              py-3
                              text-xs
                              font-bold
                              text-gray-400
                              shadow-lg
                              shadow-gray-600/10
                              hover:bg-gray-700/30

                              max-[640px]:rounded-lg
                              max-[640px]:border
                              max-[640px]:px-1.5
                              max-[640px]:py-2
                              max-[640px]:text-[10px]

                              sm:px-4
                              sm:py-5
                              sm:text-lg

                              landscape:max-md:rounded-lg
                              landscape:max-md:border
                              landscape:max-md:px-1
                              landscape:max-md:py-2
                              landscape:max-md:text-[8px]
                            "
                          >
                            {ui.noAnswer}
                          </motion.button>
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>

                {/* QUESTION LIFELINES */}

                <aside
                  className="
                    order-2
                    min-w-0
                    self-start
                    rounded-xl
                    border
                    border-[#1E293B]
                    bg-[#0F172A]
                    p-2

                    sm:p-3

                    landscape:max-md:rounded-lg
                    landscape:max-md:p-1.5
                  "
                  dir={direction}
                >
                  <div
                    className="
                      mb-3
                      flex
                      items-center
                      justify-between
                      gap-2

                      landscape:max-md:mb-1
                    "
                  >
                    <h3
                      className="
                        text-base
                        font-bold
                        text-[#D4A843]

                        landscape:max-md:text-[9px]
                      "
                    >
                      وسائل المساعدة
                    </h3>

                    <span
                      className="
                        text-[10px]
                        text-gray-500

                        landscape:max-md:text-[6px]
                      "
                    >
                      {questionTeam === 1
                        ? team1Name
                        : team2Name}
                    </span>
                  </div>

                  {!isRevealed && (
                    <LifelineList
                      lifelines={currentLifelines.filter(
                        (lifeline) =>
                          [
                            'double',
                            'wheel',
                            'call',
                            'block',
                            'two-answers',
                          ].includes(
                            lifeline.id,
                          ),
                      )}
                      accent={
                        questionTeam === 1
                          ? 'royal'
                          : 'gold'
                      }
                      getDisabled={
                        getLifelineDisabled
                      }
                      activeLifelineId={
                        activeLifelineId
                      }
                      onSelect={
                        handleUseLifeline
                      }
                    />
                  )}

                  <p
                    className="
                      mt-3
                      text-center
                      text-[11px]
                      leading-relaxed
                      text-gray-500

                      landscape:max-md:mt-1
                      landscape:max-md:text-[7px]
                    "
                  >
                    يمكنك استخدام وسيلة مساعدة واحدة
                    فقط في كل سؤال
                  </p>

                  {/* CALL FRIEND */}

                  {callFriendActive &&
                    callFriendTimeLeft > 0 && (
                      <div
                        className="
                          mt-3
                          rounded-lg
                          border
                          border-[#3B82F6]/40
                          bg-[#3B82F6]/10
                          p-2
                          text-center

                          landscape:max-md:mt-1
                          landscape:max-md:p-1
                        "
                      >
                        <div
                          className="
                            text-xs
                            font-bold
                            text-[#60A5FA]

                            landscape:max-md:text-[7px]
                          "
                        >
                          📞 اتصال بصديق —{' '}
                          {callFriendTimeLeft} ثانية
                        </div>

                        <p
                          className="
                            mt-2
                            text-xs
                            leading-relaxed
                            text-gray-200

                            landscape:max-md:mt-1
                            landscape:max-md:text-[7px]
                          "
                        >
                          {callFriendHint}
                        </p>

                        <button
                          type="button"
                          onClick={
                            clearCallFriend
                          }
                          className="
                            mt-2
                            rounded-md
                            border
                            border-[#3B82F6]/40
                            px-2
                            py-1
                            text-[11px]
                            font-bold
                            text-[#93C5FD]
                            hover:bg-[#3B82F6]/10

                            landscape:max-md:mt-1
                            landscape:max-md:px-1
                            landscape:max-md:py-0.5
                            landscape:max-md:text-[7px]
                          "
                        >
                          إغلاق الاتصال
                        </button>

                        <div
                          className="
                            mt-2
                            h-1
                            overflow-hidden
                            rounded-full
                            bg-[#1E293B]

                            landscape:max-md:mt-1
                            landscape:max-md:h-0.5
                          "
                        >
                          <motion.div
                            initial={{
                              width: '100%',
                            }}
                            animate={{
                              width: `${
                                (callFriendTimeLeft /
                                  30) *
                                100
                              }%`,
                            }}
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

      {/* SCORE BURST */}

      <AnimatePresence>
        {burst && (
          <motion.div
            key={`${burst.team}-${burst.points}`}
            initial={{
              opacity: 0,
              y: 18,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -20,
              scale: 0.9,
            }}
            className={cn(
              `
                pointer-events-none
                fixed
                bottom-6
                end-6
                z-[60]
                rounded-2xl
                border-2
                px-4
                py-3
                text-lg
                font-black
                shadow-2xl

                landscape:max-md:bottom-2
                landscape:max-md:px-2
                landscape:max-md:py-1
                landscape:max-md:text-sm
              `,
              burst.team === 1
                ? `
                  border-[#3B82F6]/60
                  bg-[#3B82F6]/20
                  text-[#93C5FD]
                  shadow-[#3B82F6]/30
                `
                : `
                  border-[#EF4444]/60
                  bg-[#EF4444]/20
                  text-[#FCA5A5]
                  shadow-[#EF4444]/30
                `,
            )}
          >
            {burst.points > 0 ? `+${burst.points}` : burst.points}
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHEEL BONUS */}

      <AnimatePresence>
        {wheelBonus && (
          <motion.div
            key={`wheel-${wheelBonus.teamId}-${wheelBonus.points}`}
            initial={{
              opacity: 0,
              y: 18,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -20,
              scale: 0.9,
            }}
            className={cn(
              `
                pointer-events-none
                fixed
                bottom-6
                start-6
                z-[60]
                rounded-2xl
                border-2
                px-4
                py-3
                text-lg
                font-black
                shadow-2xl

                landscape:max-md:bottom-2
                landscape:max-md:px-2
                landscape:max-md:py-1
                landscape:max-md:text-sm
              `,
              wheelBonus.teamId === 1
                ? `
                  border-[#3B82F6]/60
                  bg-[#3B82F6]/20
                  text-[#93C5FD]
                  shadow-[#3B82F6]/30
                `
                : `
                  border-[#EF4444]/60
                  bg-[#EF4444]/20
                  text-[#FCA5A5]
                  shadow-[#EF4444]/30
                `,
            )}
          >
            🎡 {wheelBonus.points > 0 ? `+${wheelBonus.points}` : wheelBonus.points}
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHEEL OF FORTUNE — modal opens when the wheel lifeline is used */}

      <WheelOfFortune
        open={wheelPending}
        english={direction === 'ltr'}
        onResult={applyWheelResult}
        onClose={closeWheel}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ONLINE REVIEW PANEL — answers + auto-grading + host override
// ═══════════════════════════════════════════════════════════════════

/** Normalize an answer for fuzzy comparison: trim, collapse whitespace, lowercase, normalize Arabic-Indic digits. */
function normalizeAnswer(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic → 0-9
}

/** Auto-grade a player's answer against the correct answer. */
function autoGrade(playerAnswer: string, correctAnswer: string): 'correct' | 'wrong' {
  const a = normalizeAnswer(playerAnswer)
  const b = normalizeAnswer(correctAnswer)
  if (a === b) return 'correct'
  // Levenshtein-like: allow 1 edit for short answers, 2 for longer
  if (a.length >= 3 && b.length >= 3) {
    const maxEdits = a.length <= 6 ? 1 : 2
    if (levenshtein(a, b) <= maxEdits) return 'correct'
  }
  return 'wrong'
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

function OnlineReviewPanel({
  onlineAnswers,
  onlineAutoGrades,
  onlineFinalGrades,
  onlineGamePhase,
  correctAnswer,
  players,
  onOverrideGrade,
  onConfirmReview,
  direction,
}: {
  onlineAnswers: Record<string, string>
  onlineAutoGrades: Record<string, 'correct' | 'wrong' | null>
  onlineFinalGrades: Record<string, 'correct' | 'wrong'>
  onlineGamePhase: 'answering' | 'review' | null
  correctAnswer: string
  players: { id: string; name: string }[]
  onOverrideGrade: (playerId: string, grade: 'correct' | 'wrong') => void
  onConfirmReview: () => void
  direction: 'ltr' | 'rtl'
}) {
  const isReview = onlineGamePhase === 'review'

  // Auto-compute grades for players who submitted but don't have a grade yet
  const entries = players
    .filter((p) => onlineAnswers[p.id] !== undefined)
    .map((p) => {
      const answer = onlineAnswers[p.id]!
      const autoGrade_ = onlineAutoGrades[p.id] ?? autoGrade(answer, correctAnswer)
      const finalGrade = onlineFinalGrades[p.id] ?? autoGrade_
      return { player: p, answer, autoGrade: autoGrade_, finalGrade }
    })

  // Players who didn't answer
  const absent = players.filter((p) => onlineAnswers[p.id] === undefined)

  if (!isReview) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border border-[#1E293B] bg-[#0F172A] p-3"
    >
      <h4 className="mb-2 text-xs font-black tracking-wider text-[#D4A843]">
        {direction === 'ltr' ? 'ANSWERS' : 'الإجابات'}
      </h4>

      {/* Correct answer */}
      <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
        <p className="text-[10px] font-bold text-emerald-400">
          {direction === 'ltr' ? 'Correct Answer' : 'الإجابة الصحيحة'}
        </p>
        <p className="text-sm font-black text-emerald-300">{correctAnswer}</p>
      </div>

      {/* Answer rows */}
      <div className="space-y-1.5">
        {entries.map(({ player, answer, autoGrade: ag, finalGrade: fg }) => {
          const isCorrect = fg === 'correct'
          const overridden = ag !== fg
          return (
            <div key={player.id} className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{player.name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{answer || '—'}</span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-black ${isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {isCorrect ? '✓' : '✕'}{overridden ? ' ★' : ''}
              </span>
              {/* Override buttons */}
              <button
                type="button"
                onClick={() => onOverrideGrade(player.id, 'correct')}
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold transition ${fg === 'correct' ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300' : 'border-gray-600/30 bg-gray-800/20 text-gray-500 hover:border-emerald-500/40 hover:text-emerald-300'}`}
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => onOverrideGrade(player.id, 'wrong')}
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold transition ${fg === 'wrong' ? 'border-red-500/60 bg-red-500/20 text-red-300' : 'border-gray-600/30 bg-gray-800/20 text-gray-500 hover:border-red-500/40 hover:text-red-300'}`}
              >
                ✕
              </button>
            </div>
          )
        })}
        {absent.map((player) => (
          <div key={player.id} className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{player.name}</span>
            <span className="shrink-0 rounded bg-gray-500/20 px-2 py-0.5 text-[10px] font-black text-gray-500">
              {direction === 'ltr' ? 'No answer' : 'لم يُجب'}
            </span>
          </div>
        ))}
      </div>

      {/* Confirm / Next Question button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onConfirmReview}
        className="mt-3 w-full rounded-xl bg-[#D4A843] px-4 py-2.5 text-sm font-black text-[#0B1220] shadow-lg shadow-[#D4A843]/10 transition hover:bg-[#E0B84D]"
      >
        {direction === 'ltr' ? 'Next Question' : 'السؤال التالي'}
      </motion.button>
    </motion.div>
  )
}
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultLifelines } from '../data/lifelines'
import { ensureLocalQuestionsLoaded, getQuestionEntries, getQuestionEntriesByPoints, loadRemoteQuestions } from '../data/questionLoader'
import { notifyOnlineGameEvent, resetOnlineGameSync } from '../services/online/onlineGameSync'
import type { ActiveQuestion, BoardCell, FfaPlayerState, GameMode, Lifeline, LifelineId, PointValue } from '../types/board'
import { cellKey, POINT_SLOTS, TOTAL_CATEGORIES } from '../types/board'
import type { TeamId } from '../types/game'
import { useGameSetupStore } from './gameSetupStore'
import { useAppStore } from './appStore'
import { useOnlineStore } from './onlineStore'

interface GameBoardState {
  isInitialized: boolean
  gameMode: GameMode
  isRevealed: boolean
  /** Set when the last question is finished; guards navigation to Results. */
  isGameFinished: boolean
  gameName: string
  team1Name: string
  team2Name: string
  categoryIds: string[]
  cells: BoardCell[][]
  currentTurn: TeamId
  team1Score: number
  team2Score: number
  team1Lifelines: Lifeline[]
  team2Lifelines: Lifeline[]
  activeQuestion: ActiveQuestion | null
  usedQuestionKeys: string[]

  /**
   * Free-for-all online games (3+ players): per-player state. Empty for
   * 2-player online and for local games (those keep the team1/team2 model).
   */
  ffaPlayers: FfaPlayerState[]
  /** Whose turn it is in a free-for-all game (player id). */
  ffaTurnPlayerId: string | null
  ffaPendingDoublePlayerId: string | null
  ffaBlockedPlayerId: string | null
  ffaCallFriendPlayerId: string | null

  pendingDoublePoints: TeamId | null
  blockActive: TeamId | null
  callFriendActive: TeamId | null
  callFriendTimeLeft: number
  callFriendHint: string | null
  wheelBonus: { teamId: TeamId; points: number } | null
  /** True while the Wheel-of-Fortune modal is open awaiting the spin. */
  wheelPending: boolean
  /** Team the pending wheel belongs to (2-player / team mode). */
  wheelPendingTeam: TeamId | null
  /** Player the pending wheel belongs to (free-for-all). */
  ffaWheelPendingPlayerId: string | null
  answerSubmitted: boolean
  selectedAnswer: string | null
  answerCorrect: boolean | null
  answerPoints: number

  initializeBoard: (mode?: GameMode, ffaPlayers?: { id: string; name: string; lifelineIds?: LifelineId[] }[]) => Promise<void>
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  selectQuestion: (categoryId: string, slotIndex: number) => ActiveQuestion | null

  clearActiveQuestion: () => void
  getCell: (categoryId: string, slotIndex: number) => BoardCell | undefined
  switchTurn: () => void
  resolveQuestion: (winner: TeamId | null) => void
  submitAnswer: (answer: string) => void
  finishSubmittedQuestion: () => void
  useLifeline: (lifelineId: LifelineId) => void
  /**
   * Applies the landed Wheel-of-Fortune outcome to the acting team/player's
   * score (can be negative). Called by the wheel modal after the spin.
   */
  applyWheelResult: (points: number) => void
  /** Dismisses the wheel modal without applying a result (lifeline stays used). */
  closeWheel: () => void
  clearCallFriend: () => void
  tickCallFriend: () => void
  revealAnswer: () => void
  hideAnswer: () => void
  resetReveal: () => void
}

/**
 * The team the local player controls in an online game (host = team 1,
 * joiner = team 2). Returns null when there is no active online session.
 */
function getOnlinePlayerTeam(): TeamId | null {
  const online = useOnlineStore.getState()
  if (!online.self || !online.room) return null
  return online.self.id === online.room.hostId ? 1 : 2
}

/** The local player's own id in an online room, or null. */
function getOnlineSelfId(): string | null {
  return useOnlineStore.getState().self?.id ?? null
}

/** Total cell count a single player must use before the FFA game ends. */
function ffaTotalCells(categoryIds: string[]): number {
  return categoryIds.length * POINT_SLOTS.length
}

/**
 * Next player id in the FFA order (cycling). Players who already used ALL of
 * their cells are skipped so the game can keep flowing for the rest.
 */
function nextFfaPlayerId(
  players: FfaPlayerState[],
  currentId: string,
  totalCells: number,
): string {
  if (players.length === 0) return currentId
  const index = players.findIndex((player) => player.playerId === currentId)
  const start = index === -1 ? 0 : index
  for (let step = 1; step <= players.length; step += 1) {
    const candidate = players[(start + step) % players.length]
    if (candidate.usedCells.length < totalCells) return candidate.playerId
  }
  // Everyone else is done — the game ends, keep the current player.
  return players[start % players.length]?.playerId ?? currentId
}

function buildCells(categoryIds: string[]): BoardCell[][] {
  return categoryIds.map((categoryId) =>
    POINT_SLOTS.map((points, slotIndex) => ({
      categoryId,
      slotIndex,
      points,
      team1Played: false,
      team2Played: false,
    })),
  )
}

function repairCategoryIds(rawCategoryIds: string[]): string[] {
  const seen = new Set<string>()
  const repaired: string[] = []

  if (Array.isArray(rawCategoryIds)) {
    for (const id of rawCategoryIds) {
      if (repaired.length >= TOTAL_CATEGORIES) break
      if (!id || typeof id !== 'string' || seen.has(id)) continue
      seen.add(id)
      repaired.push(id)
    }
  }

  if (repaired.length < TOTAL_CATEGORIES) {
    // IMPORTANT: these must be REAL category ids (with question files), never
    // section ids — a section id ('history' / 'movies' / 'sports') has no
    // category entry, which would make the board show the English id as the
    // title and leave its cells with no questions to load.
    const fillerPool = [
      'general-knowledge',
      'football',
      'countries',
      'capitals',
      'flags',
      'civilizations',
      'science',
      'technology',
      'arabic-movies',
      'uefa-champions',
    ]
    for (const id of fillerPool) {
      if (repaired.length >= TOTAL_CATEGORIES) break
      if (!id || seen.has(id)) continue
      seen.add(id)
      repaired.push(id)
    }
  }

  return repaired
}

function repairCells(categoryIds: string[], rawCells: BoardCell[][]): BoardCell[][] {
  return categoryIds.map((categoryId) => {
    const existingColumn = rawCells.find((column) => column[0]?.categoryId === categoryId)
    if (existingColumn && existingColumn.length === POINT_SLOTS.length) {
      return existingColumn
    }
    return POINT_SLOTS.map((points, slotIndex) => ({
      categoryId,
      slotIndex,
      points,
      team1Played: false,
      team2Played: false,
    }))
  })
}

function buildLifelinesFromIds(ids: LifelineId[]): Lifeline[] {
  const all = defaultLifelines()
  return ids
    .map((id) => all.find((l) => l.id === id))
    .filter((l): l is Lifeline => l !== undefined)
    .map((l) => ({ ...l, used: false }))
}

function cloneLifelines(): Lifeline[] {
  return defaultLifelines().map((lifeline) => ({ ...lifeline }))
}

/** True when the current game is an online free-for-all (3+ players). */
function isFfaGame(state: Pick<GameBoardState, 'gameMode' | 'ffaPlayers'>): boolean {
  return state.gameMode === 'online' && state.ffaPlayers.length >= 3
}

/** Builds the initial per-player state for a free-for-all online game. */
function buildFfaPlayers(
  players: { id: string; name: string; lifelineIds?: LifelineId[] }[],
): FfaPlayerState[] {
  const enabledLifelines = useAppStore.getState().enabledLifelines
  return players.map((player) => ({
    playerId: player.id,
    name: player.name,
    score: 0,
    usedCells: [],
    lifelines: buildLifelinesFromIds(
      (player.lifelineIds ?? []).filter((id) => enabledLifelines.includes(id)),
    ),
  }))
}


function temporaryAnswerType(question: string, answer: string): string {
  const text = question.toLowerCase()
  const normalizedAnswer = answer.trim()
  if (/^-?\d+(?:[.,]\d+)?$/.test(normalizedAnswer.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[,،]/g, '.'))) {
    return /متى|أي سنة|اي سنة|أي عام|اي عام/.test(text) ? 'year' : 'number'
  }
  if (/متى|أي سنة|اي سنة|أي عام|اي عام/.test(text)) return 'year'
  if (/ممثل|ممثلة|لعب دور/.test(text)) return 'actor'
  if (/مخرج/.test(text)) return 'director'
  if (/مدرب/.test(text)) return 'coach'
  if (/عاصمة/.test(text)) return 'capital'
  if (/مدينة|مدينه/.test(text)) return 'city'
  if (/دولة|دوله|علم/.test(text)) return 'country'
  if (/نادي|ناد|فريق|فريق/.test(text)) return 'team'
  if (/هداف|من سجل|من اللاعب|لاعب/.test(text)) return 'player'
  if (/فيلم|مسلسل/.test(text)) return 'movie'
  if (/بطولة|بطوله|الدوري|كأس|كاس/.test(text)) return 'tournament'
  return 'other'
}

function buildTemporaryAnswerOptions(categoryId: string, questionText: string, correctAnswer: string): string[] {
  const answer = correctAnswer.trim()
  if (!answer) return []
  const type = temporaryAnswerType(questionText, answer)
  const entries = getQuestionEntries(categoryId)
  const candidates = [...new Set(entries
    .filter((entry) => entry.answer?.trim() && entry.answer.trim() !== answer)
    .filter((entry) => temporaryAnswerType(entry.question, entry.answer) === type)
    .map((entry) => entry.answer.trim()))]
  let distractors: string[] = []

  if (type === 'number' || type === 'year') {
    const value = Number(answer.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(',', '.'))
    if (Number.isFinite(value)) {
      const offsets = type === 'year' ? [-2, -1, 1] : [-2, -1, 2]
      distractors = offsets.map((offset) => String(value + offset)).filter((option) => option !== answer && Number(option) >= 0)
    }
  }

  distractors = [...new Set([...distractors, ...candidates])].slice(0, 3)
  return [answer, ...distractors].sort(() => Math.random() - 0.5)
}

function getQuestionContent(categoryId: string, points: PointValue, usedQuestionKeys: string[]) {
  const items = getQuestionEntriesByPoints(categoryId, points)

  if (items.length === 0) {
    return {
      question: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      answer: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      questionKey: '',
      found: false,
      media: '',
      mediaType: 'image',
      careerImage: '',
      answerMedia: '',
      hint: '',          answerOptions: [],
    }
  }

  const unusedItems = items.filter((item) => !usedQuestionKeys.includes(item.id ?? ''))

  if (unusedItems.length === 0) {
    return {
      question: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      answer: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      questionKey: '',
      found: false,
      media: '',
      mediaType: 'image',
      careerImage: '',
      answerMedia: '',
      hint: '',          answerOptions: [],
    }
  }

  const randomItem = unusedItems[Math.floor(Math.random() * unusedItems.length)]

  return {
    ...randomItem,
    questionKey: randomItem.id ?? `${categoryId}-${points}-${randomItem.question}`,
    found: true,
    media: randomItem.media || '',
    mediaType: (randomItem.mediaType as 'image' | 'video' | 'career') || 'image',
    careerImage: randomItem.careerImage || '',
    answerMedia: randomItem.answerMedia || '',
    hint: randomItem.hint || '',
  }
}

/**
 * Wipes every piece of ONLINE room/match state so a new match can never
 * inherit the previous one: categories, usedQuestionKeys, per-player used
 * cells, scores, lifelines, activeQuestion, reveal/finish flags and turn.
 *
 * This is called ONLY when a fresh online session starts (room creation /
 * game start). It is deliberately NOT called during reconnect — a temporary
 * disconnect must never reset the match state.
 */
export function resetOnlineMatchState(): void {
  // Clear the per-sender event-sequence tracking so no stale counter from the
  // previous match can drop events in the new one.
  resetOnlineGameSync()
  useGameSetupStore.setState({
    team1CategoryIds: [],
    team2CategoryIds: [],
    team1LifelineIds: [],
    team2LifelineIds: [],
    activeTeam: 1 as TeamId,
  })
  useGameBoardStore.setState({
    isInitialized: false,
    isRevealed: false,
    isGameFinished: false,
    categoryIds: [],
    cells: [],
    currentTurn: 1 as TeamId,
    team1Score: 0,
    team2Score: 0,
    team1Lifelines: [],
    team2Lifelines: [],
    activeQuestion: null,
    usedQuestionKeys: [],
    ffaPlayers: [],
    ffaTurnPlayerId: null,
    ffaPendingDoublePlayerId: null,
    ffaBlockedPlayerId: null,
    ffaCallFriendPlayerId: null,
    pendingDoublePoints: null,
    blockActive: null,
    callFriendActive: null,
    callFriendTimeLeft: 0,
    callFriendHint: null,
    wheelBonus: null,
    wheelPending: false,
    wheelPendingTeam: null,
    ffaWheelPendingPlayerId: null,
    answerSubmitted: false,
    selectedAnswer: null,
    answerCorrect: null,
    answerPoints: 0,
  })
}

export const useGameBoardStore = create<GameBoardState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      gameMode: 'local',
      isRevealed: false,
      isGameFinished: false,
      gameName: '',
      team1Name: '',
      team2Name: '',
      categoryIds: [],
      cells: [],
      currentTurn: 1,
      team1Score: 0,
      team2Score: 0,
      team1Lifelines: cloneLifelines(),
      team2Lifelines: cloneLifelines(),
      activeQuestion: null,
      usedQuestionKeys: [],
      ffaPlayers: [],
      ffaTurnPlayerId: null,
      ffaPendingDoublePlayerId: null,
      ffaBlockedPlayerId: null,
      ffaCallFriendPlayerId: null,

      pendingDoublePoints: null,
      blockActive: null,
      callFriendActive: null,
      callFriendTimeLeft: 0,
      callFriendHint: null,
      wheelBonus: null,
      wheelPending: false,
      wheelPendingTeam: null,
      ffaWheelPendingPlayerId: null,
      answerSubmitted: false,
      selectedAnswer: null,
      answerCorrect: null,
      answerPoints: 0,

      initializeBoard: async (mode = 'local', ffaPlayers) => {
        // Load the remote (Supabase) questions AND every local question JSON
        // before the board becomes playable. Local questions are lazy chunks,
        // so they are fetched here — on demand — never at app startup.
        await Promise.all([loadRemoteQuestions(), ensureLocalQuestionsLoaded()])
        localStorage.removeItem('quizmaster-board')
        const setup = useGameSetupStore.getState()
        const rawCategoryIds = [...setup.team1CategoryIds, ...setup.team2CategoryIds]
        const finalCategoryIds = repairCategoryIds(rawCategoryIds)

        const enabledLifelines = useAppStore.getState().enabledLifelines
        const team1Lifelines = buildLifelinesFromIds(
          (setup.team1LifelineIds as LifelineId[]).filter((id) => enabledLifelines.includes(id)),
        )
        const team2Lifelines = buildLifelinesFromIds(
          (setup.team2LifelineIds as LifelineId[]).filter((id) => enabledLifelines.includes(id)),
        )

        const nextFfaPlayers =
          mode === 'online' && ffaPlayers && ffaPlayers.length >= 3
            ? buildFfaPlayers(ffaPlayers)
            : []

        set({
          isInitialized: true,
          gameMode: mode,
          isRevealed: false,
          isGameFinished: false,
          gameName: setup.gameName || 'مسابقة تجريبية',
          team1Name: setup.team1Name || 'الفريق الأول',
          team2Name: setup.team2Name || 'الفريق الثاني',
          categoryIds: finalCategoryIds,
          cells: buildCells(finalCategoryIds),
          currentTurn: 1,
          team1Score: 0,
          team2Score: 0,
          team1Lifelines,
          team2Lifelines,
          activeQuestion: null,
          usedQuestionKeys: [],
          ffaPlayers: nextFfaPlayers,
          ffaTurnPlayerId: nextFfaPlayers[0]?.playerId ?? null,
          ffaPendingDoublePlayerId: null,
          ffaBlockedPlayerId: null,
          ffaCallFriendPlayerId: null,
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          wheelPending: false,
          wheelPendingTeam: null,
          ffaWheelPendingPlayerId: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })
      },

      getCell: (categoryId, slotIndex) => {
        const column = get().cells.find((col) => col[0]?.categoryId === categoryId)
        return column?.[slotIndex]
      },

      isCellPlayable: (categoryId, slotIndex) => {
        const state = get()
        const cell = state.getCell(categoryId, slotIndex)
        if (!cell) return false

        // Online: only the player whose turn it is may play a cell.
        if (state.gameMode === 'online') {
          const ffa = isFfaGame(state)
          if (ffa) {
            const selfId = getOnlineSelfId()
            if (!selfId || state.ffaTurnPlayerId !== selfId) return false
          } else if (getOnlinePlayerTeam() !== state.currentTurn) {
            return false
          }
        }

        // Free-for-all: each player sees ONLY their own used cells as used.
        // A cell another player used stays available for this player.
        if (isFfaGame(state)) {
          const selfId = getOnlineSelfId()
          if (!selfId) return false
          const self = state.ffaPlayers.find((player) => player.playerId === selfId)
          if (!self) return false
          return !self.usedCells.includes(cellKey(categoryId, slotIndex))
        }

        if (cell.team1Played || cell.team2Played) return false
        return true
      },

      selectQuestion: (categoryId, slotIndex) => {
        const state = get()
        if (state.isGameFinished) return null
        if (!state.isInitialized) return null
        if (state.activeQuestion) return null
        if (!state.isCellPlayable(categoryId, slotIndex)) return null
        const ffa = isFfaGame(state)
        const selfId = getOnlineSelfId()

        // Online: only the player whose turn it is may pick a question.
        if (state.gameMode === 'online') {
          if (ffa) {
            if (!selfId || state.ffaTurnPlayerId !== selfId) return null
          } else if (getOnlinePlayerTeam() !== state.currentTurn) {
            return null
          }
        }

        const cell = state.getCell(categoryId, slotIndex)
        if (!cell) return null

        const questionContent = getQuestionContent(categoryId, cell.points, state.usedQuestionKeys)
        const doubleApplied = ffa
          ? state.ffaPendingDoublePlayerId === selfId
          : state.pendingDoublePoints === state.currentTurn

        const questionState: ActiveQuestion = {
          categoryId,
          slotIndex,
          points: cell.points as PointValue,
          team: state.currentTurn,
          playerId: ffa ? (selfId ?? undefined) : undefined,
          questionText: questionContent.question,
          answerText: questionContent.answer,
          media: questionContent.media,
          mediaType: (questionContent.mediaType as 'image' | 'video' | 'career') || 'image',
          careerImage: questionContent.careerImage,
          answerMedia: questionContent.answerMedia,
          hint: questionContent.hint,
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied,
        }

        set({
          activeQuestion: questionState,
          usedQuestionKeys: questionContent.found && questionContent.questionKey
            ? [...get().usedQuestionKeys, questionContent.questionKey]
            : get().usedQuestionKeys,
          // Free-for-all: the cell becomes used for THIS player only, and only
          // this player's used list is updated (others keep it available).
          ...(ffa && selfId
            ? {
                ffaPlayers: state.ffaPlayers.map((player) =>
                  player.playerId === selfId
                    ? { ...player, usedCells: [...player.usedCells, cellKey(categoryId, slotIndex)] }
                    : player,
                ),
                ffaPendingDoublePlayerId: null,
              }
            : {}),
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })

        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('QUESTION_SELECTED', {
            categoryId,
            slotIndex,
            points: cell.points,
            team: state.currentTurn,
            questionId: questionContent.questionKey || '',
            doubleApplied,
            playerId: ffa ? (selfId ?? undefined) : undefined,
          })
        }
        return questionState
      },


      clearActiveQuestion: () =>
        set({
          activeQuestion: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        }),

      switchTurn: () => {
        // Online: the turn is driven by resolving questions, never manually.
        if (get().gameMode === 'online') return
        if (get().isGameFinished) return
        set((state) => ({
          currentTurn: state.currentTurn === 1 ? 2 : 1,
        }))
      },

      resolveQuestion: (winner) => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion) return
        // GAME_FINISHED guard: prevent score modifications after game is finished
        if (state.isGameFinished) return
        // Online: the HOST is the only one who judges the answer status
        // (correct / wrong / no one answered). The joiner cannot resolve.
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== 1) return

        const ffa = isFfaGame(state)

        // ---- Free-for-all (3+ players): the question belongs to ONE player,
        // the host judges whether that player answered correctly. ----
        if (ffa) {
          const ownerId = activeQuestion.playerId
          const owner = state.ffaPlayers.find((player) => player.playerId === ownerId)
          if (!ownerId || !owner) return

          let points = activeQuestion.points
          if (activeQuestion.doubleApplied) points = points * 2

          const blocked =
            winner === 1 && state.ffaBlockedPlayerId === ownerId
          const awarded = winner === 1 && !blocked ? points : 0

          const nextFfaPlayers = state.ffaPlayers.map((player) =>
            player.playerId === ownerId
              ? { ...player, score: player.score + awarded }
              : player,
          )
          const totalCells = ffaTotalCells(state.categoryIds)
          const nextTurnId = nextFfaPlayerId(nextFfaPlayers, ownerId, totalCells)
          const allUsed = nextFfaPlayers.every(
            (player) => player.usedCells.length >= totalCells,
          )

          set({
            ffaPlayers: nextFfaPlayers,
            ffaTurnPlayerId: nextTurnId,
            ffaPendingDoublePlayerId: null,
            ffaBlockedPlayerId: null,
            ffaCallFriendPlayerId: null,
            callFriendTimeLeft: 0,
            callFriendHint: null,
            isGameFinished: allUsed,
            activeQuestion: null,
            pendingDoublePoints: null,
            blockActive: null,
            callFriendActive: null,
            answerSubmitted: false,
            selectedAnswer: null,
            answerCorrect: null,
            answerPoints: 0,
          })

          notifyOnlineGameEvent('SCORE_UPDATED', {
            team1Score: state.team1Score,
            team2Score: state.team2Score,
            questionClosed: true,
            ffaPlayers: nextFfaPlayers,
          })
          notifyOnlineGameEvent('TURN_CHANGED', {
            currentTurn: 1,
            playerId: nextTurnId,
          })

          if (allUsed) {
            notifyOnlineGameEvent('GAME_FINISHED', {
              winner: null,
              team1Score: state.team1Score,
              team2Score: state.team2Score,
              ffaPlayers: nextFfaPlayers,
            })
          }
          return
        }

        let points = activeQuestion.points
        let blocked = false

        if (activeQuestion.doubleApplied) {
          points = points * 2
        }

        if (winner === 1 && state.blockActive === 1) {
          blocked = true
        }

        if (winner === 2 && state.blockActive === 2) {
          blocked = true
        }

        const nextCells = state.cells.map((column) =>
          column.map((cell) => {
            if (
              cell.categoryId !== activeQuestion.categoryId ||
              cell.slotIndex !== activeQuestion.slotIndex
            ) {
              return cell
            }

            return {
              ...cell,
              team1Played: true,
              team2Played: true,
            }
          }),
        )

        const nextTurn: TeamId = state.currentTurn === 1 ? 2 : 1
        const allUsed = nextCells.flat().every((cell) => cell.team1Played && cell.team2Played)

        let team1Score = state.team1Score
        let team2Score = state.team2Score

        if (winner === 1 && !blocked) {
          team1Score += points
        } else if (winner === 2 && !blocked) {
          team2Score += points
        }

        set({
          cells: nextCells,
          currentTurn: nextTurn,
          team1Score,
          team2Score,
          isGameFinished: allUsed,
          activeQuestion: null,
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })

        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('SCORE_UPDATED', {
            team1Score,
            team2Score,
            cells: nextCells,
            questionClosed: true,
          })
          notifyOnlineGameEvent('TURN_CHANGED', { currentTurn: nextTurn })

          if (allUsed) {
            const finalWinner: TeamId | null =
              team1Score === team2Score ? null : team1Score > team2Score ? 1 : 2
            notifyOnlineGameEvent('GAME_FINISHED', {
              winner: finalWinner,
              team1Score,
              team2Score,
            })
          }
        }
      },

      submitAnswer: (answer) => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion || activeQuestion.answered || state.answerSubmitted) return
        // GAME_FINISHED guard: prevent answer submission after game is finished
        if (state.isGameFinished) return

        const ffa = isFfaGame(state)
        const selfId = getOnlineSelfId()

        // Online: only the player who owns the question may answer it.
        if (state.gameMode === 'online') {
          if (ffa) {
            if (!selfId || activeQuestion.playerId !== selfId) return
          } else if (getOnlinePlayerTeam() !== activeQuestion.team) {
            return
          }
        }

        // LOCAL MODE: the classic auto-judge — the answer is matched against
        // the expected text and the points are applied immediately.
        //
        // ONLINE MODE: NO automatic matching — the HOST is the judge. Submitting
        // an answer only RECORDS it (answerSubmitted + selectedAnswer) so the
        // host sees exactly what the player picked. The score is applied later
        // when the host marks the answer correct/wrong via resolveQuestion
        // (host-gated). This keeps scoring rules identical, it only moves WHO
        // decides correct/wrong to the host.
        if (state.gameMode === 'online') {
          set({
            activeQuestion: { ...activeQuestion, answered: true },
            answerSubmitted: true,
            selectedAnswer: answer,
            answerCorrect: null,
            answerPoints: 0,
          })
          notifyOnlineGameEvent('SCORE_UPDATED', {
            team1Score: state.team1Score,
            team2Score: state.team2Score,
            answered: {
              selectedAnswer: answer,
              answerCorrect: null,
              answerPoints: 0,
            },
          })
          return
        }

        const isCorrect = answer === activeQuestion.answerText
        const points = activeQuestion.doubleApplied ? activeQuestion.points * 2 : activeQuestion.points
        const blocked = ffa
          ? isCorrect && state.ffaBlockedPlayerId === activeQuestion.playerId
          : isCorrect && state.blockActive === activeQuestion.team
        const awardedPoints = isCorrect && !blocked ? points : 0

        const nextFfaPlayers = ffa
          ? state.ffaPlayers.map((player) =>
              player.playerId === activeQuestion.playerId
                ? { ...player, score: player.score + awardedPoints }
                : player,
            )
          : state.ffaPlayers

        const nextTeam1Score = ffa
          ? state.team1Score
          : activeQuestion.team === 1
            ? state.team1Score + awardedPoints
            : state.team1Score
        const nextTeam2Score = ffa
          ? state.team2Score
          : activeQuestion.team === 2
            ? state.team2Score + awardedPoints
            : state.team2Score

        set({
          team1Score: nextTeam1Score,
          team2Score: nextTeam2Score,
          ...(ffa ? { ffaPlayers: nextFfaPlayers } : {}),
          activeQuestion: { ...activeQuestion, answered: true },
          answerSubmitted: true,
          selectedAnswer: answer,
          answerCorrect: isCorrect,
          answerPoints: awardedPoints,
        })
      },

      finishSubmittedQuestion: () => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion || !state.answerSubmitted) return

        const ffa = isFfaGame(state)

        // Online: the HOST is the controller — only the host finishes a
        // question (2-player team mode AND free-for-all). The owner never
        // closes their own question; the host's judgment does.
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== 1) return

        // ---- Free-for-all ----
        if (ffa) {
          const ownerId = activeQuestion.playerId
          if (!ownerId) return
          const totalCells = ffaTotalCells(state.categoryIds)
          const nextTurnId = nextFfaPlayerId(state.ffaPlayers, ownerId, totalCells)
          const allUsed = state.ffaPlayers.every(
            (player) => player.usedCells.length >= totalCells,
          )

          set({
            ffaTurnPlayerId: nextTurnId,
            ffaPendingDoublePlayerId: null,
            ffaBlockedPlayerId: null,
            ffaCallFriendPlayerId: null,
            callFriendTimeLeft: 0,
            callFriendHint: null,
            isGameFinished: allUsed,
            activeQuestion: null,
            pendingDoublePoints: null,
            blockActive: null,
            callFriendActive: null,
            answerSubmitted: false,
            selectedAnswer: null,
            answerCorrect: null,
            answerPoints: 0,
          })

          notifyOnlineGameEvent('SCORE_UPDATED', {
            team1Score: state.team1Score,
            team2Score: state.team2Score,
            questionClosed: true,
            ffaPlayers: state.ffaPlayers,
          })
          notifyOnlineGameEvent('TURN_CHANGED', {
            currentTurn: 1,
            playerId: nextTurnId,
          })

          if (allUsed) {
            notifyOnlineGameEvent('GAME_FINISHED', {
              winner: null,
              team1Score: state.team1Score,
              team2Score: state.team2Score,
              ffaPlayers: state.ffaPlayers,
            })
          }
          return
        }

        const nextCells = state.cells.map((column) =>
          column.map((cell) =>
            cell.categoryId === activeQuestion.categoryId && cell.slotIndex === activeQuestion.slotIndex
              ? { ...cell, team1Played: true, team2Played: true }
              : cell,
          ),
        )

        const nextTurn: TeamId = state.currentTurn === 1 ? 2 : 1
        const allUsed = nextCells.flat().every((cell) => cell.team1Played && cell.team2Played)

        set({
          cells: nextCells,
          currentTurn: nextTurn,
          isGameFinished: allUsed,
          activeQuestion: null,
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })

        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('SCORE_UPDATED', {
            team1Score: state.team1Score,
            team2Score: state.team2Score,
            cells: nextCells,
            questionClosed: true,
          })
          notifyOnlineGameEvent('TURN_CHANGED', { currentTurn: nextTurn })

          if (allUsed) {
            const finalWinner: TeamId | null =
              state.team1Score === state.team2Score ? null : state.team1Score > state.team2Score ? 1 : 2
            notifyOnlineGameEvent('GAME_FINISHED', {
              winner: finalWinner,
              team1Score: state.team1Score,
              team2Score: state.team2Score,
            })
          }
        }
      },

      useLifeline: (lifelineId) => {
        const state = get()
        if (state.isGameFinished) return
        const ffa = isFfaGame(state)
        const selfId = getOnlineSelfId()

        // ---- Free-for-all (3+ players): lifelines belong to the acting
        // player (the question owner, or the player whose turn it is). ----
        if (ffa) {
          const actingPlayerId = state.activeQuestion?.playerId ?? state.ffaTurnPlayerId
          if (!selfId || !actingPlayerId || selfId !== actingPlayerId) return
          const player = state.ffaPlayers.find((entry) => entry.playerId === actingPlayerId)
          if (!player) return

          const lifelinesKey = player.lifelines
          const lifeline = lifelinesKey.find((l) => l.id === lifelineId)
          if (!lifeline || lifeline.used) return

          const markUsed = () => ({
            ffaPlayers: state.ffaPlayers.map((entry) =>
              entry.playerId === actingPlayerId
                ? {
                    ...entry,
                    lifelines: entry.lifelines.map((l) =>
                      l.id === lifelineId ? { ...l, used: true } : l,
                    ),
                  }
                : entry,
            ),
          })

          if (lifelineId === 'double') {
            if (state.ffaPendingDoublePlayerId !== null) return
            if (state.activeQuestion) {
              if (state.activeQuestion.answered || state.activeQuestion.lifelineUsed) return
              set({
                ...markUsed(),
                activeQuestion: {
                  ...state.activeQuestion,
                  doubleApplied: true,
                  lifelineUsed: 'double',
                },
              })
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: 1,
                lifelineId: 'double',
                doubleApplied: true,
                playerId: actingPlayerId,
              })
            } else {
              set({ ...markUsed(), ffaPendingDoublePlayerId: actingPlayerId })
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: 1,
                lifelineId: 'double',
                pendingDoublePlayerId: actingPlayerId,
                playerId: actingPlayerId,
              })
            }
            return
          }

          if (lifelineId === 'wheel') {
            if (state.activeQuestion?.answered || state.activeQuestion?.lifelineUsed) return
            // Mark the wheel used and open the wheel modal. The outcome is
            // applied later by `applyWheelResult` once the spin lands.
            set({
              ...markUsed(),
              ffaWheelPendingPlayerId: actingPlayerId,
              wheelPending: true,
            })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: 1,
                lifelineId: 'wheel',
                playerId: actingPlayerId,
              })
            }
            return
          }

          if (!state.activeQuestion) return
          if (state.activeQuestion.answered) return
          if (state.activeQuestion.lifelineUsed) return

          if (lifelineId === 'two-answers') {
            const options = buildTemporaryAnswerOptions(
              state.activeQuestion.categoryId,
              state.activeQuestion.questionText,
              state.activeQuestion.answerText,
            )
            set({
              ...markUsed(),
              activeQuestion: {
                ...state.activeQuestion,
                twoAnswersUsed: true,
                answerOptions: options,
                lifelineUsed: lifelineId,
              },
            })
            notifyOnlineGameEvent('LIFELINE_USED', {
              team: 1,
              lifelineId,
              twoAnswersUsed: true,
              answerOptions: options,
              playerId: actingPlayerId,
            })
            return
          }

          if (lifelineId === 'block') {
            const blockedPlayerId = nextFfaPlayerId(
              state.ffaPlayers,
              actingPlayerId,
              ffaTotalCells(state.categoryIds),
            )
            set({
              ...markUsed(),
              ffaBlockedPlayerId: blockedPlayerId,
            })
            notifyOnlineGameEvent('LIFELINE_USED', {
              team: 1,
              lifelineId,
              blockedPlayerId,
              playerId: actingPlayerId,
            })
            return
          }

          if (lifelineId === 'call') {
            const hint =
              state.activeQuestion.hint?.trim() ||
              'اقتراح الصديق: ركّز على الكلمات المفتاحية في السؤال واستبعد الإجابات البعيدة عن الموضوع.'
            set({
              ...markUsed(),
              ffaCallFriendPlayerId: actingPlayerId,
              callFriendTimeLeft: 30,
              callFriendHint: hint,
            })
            notifyOnlineGameEvent('LIFELINE_USED', {
              team: 1,
              lifelineId,
              callFriendPlayerId: actingPlayerId,
              callFriendTimeLeft: 30,
              callFriendHint: hint,
              playerId: actingPlayerId,
            })
            return
          }
          return
        }

        // Online: only the player whose team owns the turn/question may use a lifeline.
        const lifelineActingTeam = state.activeQuestion ? state.activeQuestion.team : state.currentTurn
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== lifelineActingTeam) return

        if (lifelineId === 'double') {
          const teamId = state.activeQuestion?.team ?? state.currentTurn
          const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
          const lifelines = state[lifelinesKey]
          const lifeline = lifelines.find((l) => l.id === 'double')
          if (!lifeline || lifeline.used) return
          if (state.pendingDoublePoints !== null) return

          const updatedLifelines = lifelines.map((l) =>
            l.id === 'double' ? { ...l, used: true } : l,
          )

          if (state.activeQuestion) {
            if (state.activeQuestion.answered || state.activeQuestion.lifelineUsed) return
            set({
              [lifelinesKey]: updatedLifelines,
              activeQuestion: {
                ...state.activeQuestion,
                doubleApplied: true,
                lifelineUsed: 'double',
              },
            })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: teamId,
                lifelineId: 'double',
                doubleApplied: true,
              })
            }
          } else {
            set({ [lifelinesKey]: updatedLifelines, pendingDoublePoints: teamId })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: teamId,
                lifelineId: 'double',
                pendingDoublePoints: teamId,
              })
            }
          }
          return
        }

        if (lifelineId === 'wheel') {
          const teamId = state.activeQuestion?.team ?? state.currentTurn
          const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
          const lifelines = state[lifelinesKey]
          const lifeline = lifelines.find((l) => l.id === 'wheel')
          if (!lifeline || lifeline.used) return
          if (state.activeQuestion?.answered || state.activeQuestion?.lifelineUsed) return

          const updatedLifelines = lifelines.map((l) =>
            l.id === 'wheel' ? { ...l, used: true } : l,
          )
          // Mark the wheel used and open the wheel modal. The outcome is
          // applied later by `applyWheelResult` once the spin lands.
          set({
            [lifelinesKey]: updatedLifelines,
            wheelPending: true,
            wheelPendingTeam: teamId,
            ...(state.activeQuestion
              ? { activeQuestion: { ...state.activeQuestion, lifelineUsed: 'wheel' as LifelineId } }
              : {}),
          })
          if (state.gameMode === 'online') {
            notifyOnlineGameEvent('LIFELINE_USED', {
              team: teamId,
              lifelineId: 'wheel',
            })
          }
          return
        }

        if (!state.activeQuestion) return

        const teamId = state.activeQuestion.team
        const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
        const lifelines = state[lifelinesKey]
        const lifeline = lifelines.find((l) => l.id === lifelineId)

        if (!lifeline || lifeline.used) return
        if (state.activeQuestion.answered) return
        if (state.activeQuestion.lifelineUsed) return

        const updatedLifelines = lifelines.map((l) =>
          l.id === lifelineId ? { ...l, used: true } : l,
        )

        set({
          [lifelinesKey]: updatedLifelines,
          activeQuestion: { ...state.activeQuestion, lifelineUsed: lifelineId },
        })

        switch (lifelineId) {
          case 'two-answers': {
            const options = buildTemporaryAnswerOptions(
              state.activeQuestion.categoryId,
              state.activeQuestion.questionText,
              state.activeQuestion.answerText,
            )
            set({
              activeQuestion: {
                ...state.activeQuestion,
                twoAnswersUsed: true,
                answerOptions: options,
                lifelineUsed: lifelineId,
              },
            })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: teamId,
                lifelineId: lifelineId,
                twoAnswersUsed: true,
                answerOptions: options,
              })
            }
            break
          }

          case 'block': {
            const blockedTeam = teamId === 1 ? 2 : 1
            set({ blockActive: blockedTeam as TeamId })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: teamId,
                lifelineId: lifelineId,
                blockActive: blockedTeam as TeamId,
              })
            }
            break
          }

          case 'call': {
            const hint = state.activeQuestion.hint?.trim() || 'اقتراح الصديق: ركّز على الكلمات المفتاحية في السؤال واستبعد الإجابات البعيدة عن الموضوع.'
            set({ callFriendActive: teamId, callFriendTimeLeft: 30, callFriendHint: hint })
            if (state.gameMode === 'online') {
              notifyOnlineGameEvent('LIFELINE_USED', {
                team: teamId,
                lifelineId: lifelineId,
                callFriendActive: teamId,
                callFriendTimeLeft: 30,
                callFriendHint: hint,
              })
            }
            break
          }
        }
      },

      applyWheelResult: (points) => {
        const state = get()
        const ffa = isFfaGame(state)
        const selfId = getOnlineSelfId()

        // ---- Free-for-all: the outcome lands on the pending player. ----
        if (ffa) {
          const actingPlayerId = state.ffaWheelPendingPlayerId
          if (!actingPlayerId) return
          // Online: only the pending player may resolve their own wheel.
          if (state.gameMode === 'online' && selfId !== actingPlayerId) return

          const nextFfaPlayers = state.ffaPlayers.map((player) =>
            player.playerId === actingPlayerId
              ? { ...player, score: player.score + points }
              : player,
          )
          set({
            ffaPlayers: nextFfaPlayers,
            wheelBonus: { teamId: 1, points },
            // Keep the modal open so the player sees the landed result;
            // closeWheel() dismisses it after the player confirms.
            wheelPending: true,
          })
          if (state.gameMode === 'online') {
            notifyOnlineGameEvent('LIFELINE_USED', {
              team: 1,
              lifelineId: 'wheel',
              wheelBonus: { teamId: 1, points },
              scoreDelta: points,
              playerId: actingPlayerId,
            })
          }
          return
        }

        // ---- Team mode: the outcome lands on the pending team. ----
        const teamId = state.wheelPendingTeam ?? 1
        // Online: only the team that owns the wheel may resolve it.
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== teamId) return

        set((prev) => ({
          [teamId === 1 ? 'team1Score' : 'team2Score']:
            teamId === 1 ? prev.team1Score + points : prev.team2Score + points,
          wheelBonus: { teamId, points },
          // Keep the modal open so the player sees the landed result;
          // closeWheel() dismisses it after the player confirms.
          wheelPending: true,
          ...(state.activeQuestion
            ? { activeQuestion: { ...state.activeQuestion, lifelineUsed: 'wheel' as LifelineId } }
            : {}),
        }))
        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('LIFELINE_USED', {
            team: teamId,
            lifelineId: 'wheel',
            wheelBonus: { teamId, points },
            scoreDelta: points,
          })
        }
      },

      closeWheel: () =>
        set({
          wheelPending: false,
          wheelPendingTeam: null,
          ffaWheelPendingPlayerId: null,
        }),

      clearCallFriend: () => set({ callFriendActive: null, callFriendTimeLeft: 0, callFriendHint: null }),

      tickCallFriend: () => {
        const state = get()
        if (state.callFriendTimeLeft <= 0) return

        const next = state.callFriendTimeLeft - 1
        if (next <= 0) {
          set({ callFriendActive: null, callFriendTimeLeft: 0, callFriendHint: null })
        } else {
          set({ callFriendTimeLeft: next })
        }
      },

      revealAnswer: () => {
        const state = get()
        if (!state.activeQuestion) return
        // Online: revealing the answer is a HOST-only control. The joiner
        // receives the reveal state through the sync, never triggers it.
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== 1) return
        set({ isRevealed: true })
        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('ANSWER_REVEALED', { revealed: true })
        }
      },

      hideAnswer: () => {
        const state = get()
        // Online: hiding the answer is a HOST-only control (same as reveal).
        if (state.gameMode === 'online' && getOnlinePlayerTeam() !== 1) return
        set({ isRevealed: false })
        if (state.gameMode === 'online') {
          notifyOnlineGameEvent('ANSWER_REVEALED', { revealed: false })
        }
      },

      resetReveal: () => set({ isRevealed: false }),
    }),
    {
      name: 'quizmaster-board',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<GameBoardState> | undefined
        if (!persisted) return currentState

        const merged = { ...currentState, ...persisted }

        if (merged.isInitialized && Array.isArray(merged.categoryIds)) {
          merged.categoryIds = repairCategoryIds(merged.categoryIds)
          merged.cells = repairCells(merged.categoryIds, Array.isArray(merged.cells) ? merged.cells : [])
        }

        // localStorage is an untrusted boundary: repair non-finite scores
        // (a tampered/old payload must not inject NaN/Infinity) while keeping
        // legitimate NEGATIVE scores (wheel deductions) intact.
        if (!Number.isFinite(merged.team1Score)) merged.team1Score = 0
        if (!Number.isFinite(merged.team2Score)) merged.team2Score = 0
        if (!Number.isFinite(merged.answerPoints)) merged.answerPoints = 0
        // The turn is a closed set — anything else repairs to team 1.
        if (merged.currentTurn !== 1 && merged.currentTurn !== 2) merged.currentTurn = 1

        return merged
      },
      partialize: (state) => ({
        isInitialized: state.isInitialized,
        gameName: state.gameName,
        team1Name: state.team1Name,
        team2Name: state.team2Name,
        categoryIds: state.categoryIds,
        cells: state.cells,
        currentTurn: state.currentTurn,
        team1Score: state.team1Score,
        team2Score: state.team2Score,
        team1Lifelines: state.team1Lifelines,
        team2Lifelines: state.team2Lifelines,
        activeQuestion: state.activeQuestion,
        usedQuestionKeys: state.usedQuestionKeys,
        callFriendHint: state.callFriendHint,
        answerSubmitted: state.answerSubmitted,
        selectedAnswer: state.selectedAnswer,
        answerCorrect: state.answerCorrect,
        answerPoints: state.answerPoints,
      }),
    },
  ),
)

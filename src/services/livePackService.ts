import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import { ensureLocalQuestionsLoaded } from '../data/questionLoader'
import { getQuestionEntriesByPoints } from '../data/questionLoader'
import type { PointValue } from '../types/board'

// ---------------------------------------------------------------------------
// Inlined from deleted pack modules (only what the live game needs)
// ---------------------------------------------------------------------------

const CUSTOM_QUIZ_PREFIX = 'custom:'

function isCustomQuizId(quizId: string): boolean {
  return quizId.startsWith(CUSTOM_QUIZ_PREFIX)
}

async function listLegacyQuizQuestions(quizId: string): Promise<Array<{
  question: string; answer: string; points: number; hint: string | null; image_url: string | null
}>> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_questions')
    .select('question, answer, points, hint, image_url')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true })
  if (error) throw new Error('Could not load legacy quiz questions.')
  return (data ?? [])
}

function buildLegacyQuizQuestions(quizId: string, cap = 15): Array<{
  question: string; answer: string; points: number; hint?: string; media?: string; mediaType?: 'image' | 'video' | 'career'
}> {
  const tiers: PointValue[] = [100, 300, 500]
  const questions: Array<{
    question: string; answer: string; points: number; hint?: string; media?: string; mediaType?: 'image' | 'video' | 'career'
  }> = []
  for (const points of tiers) {
    const pool = getQuestionEntriesByPoints(quizId, points)
    const take = Math.min(pool.length, Math.max(1, Math.round(cap / tiers.length)))
    const picked = shuffleArray([...pool]).slice(0, take)
    for (const item of picked) {
      questions.push({
        question: item.question,
        answer: item.answer,
        hint: item.hint,
        media: item.media,
        mediaType: item.mediaType,
        points: item.points ?? points,
      })
    }
  }
  return shuffleArray(questions)
}

/**
 * Data layer for Live Pack rooms (Sporcle-Live style multiplayer).
 *
 * The database is the single source of truth: rooms / players / resolved
 * questions / answers live in Supabase tables (migration 015) and every write
 * goes through the security-definer RPCs there. Clients subscribe to Realtime
 * (postgres_changes) and react to the shared state.
 *
 * Column names are kept snake_case (postgrest-js does not transform keys).
 */

// ---------------------------------------------------------------------------
// Game phases (new gameplay model)
// ---------------------------------------------------------------------------

/**
 * The game loop has explicit phases within each question:
 *
 *   lobby          → waiting for players
 *   question_intro → "Question N" (brief 3s intro)
 *   active         → timer running, accepting answers
 *   locked         → timer expired, answers locked, grading done
 *   reveal         → showing correct answer + who got it right
 *   scoring        → showing score changes
 *   finished       → game over, final results
 */
export type GamePhase = 'lobby' | 'question_intro' | 'active' | 'locked' | 'host_review' | 'reveal' | 'scoring' | 'finished'

// ---------------------------------------------------------------------------
// Row types (mirror the DB columns)
// ---------------------------------------------------------------------------

export type LiveRoomStatus = 'lobby' | 'playing' | 'finished'

export type LiveQuestionPhase = 'active' | 'closed'

export interface LiveRoomRow {
  id: string
  host_auth_id: string
  host_player_id: string | null
  pack_id: string
  room_code: string
  host_name: string
  host_avatar_url: string | null
  pack_title: string
  status: LiveRoomStatus
  current_question_index: number
  max_players: number
  question_timeout_seconds: number
  question_count: number
  min_wager: number
  max_wager: number
  deduct_on_wrong: boolean
  question_started_at: string | null
  question_phase: LiveQuestionPhase
  /** NEW: game-phase column added by migration 033 */
  game_phase: GamePhase
  previous_room_id: string | null
  who_can_join: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface LivePlayerRow {
  id: string
  room_id: string
  user_id: string
  name: string
  avatar_url: string | null
  connected: boolean
  score: number
  correct_count: number
  wrong_count: number
  avg_wager: number
  best_win_wager: number
  joined_at: string
  is_ready: boolean
  last_seen_at: string
}

export interface LiveQuestionRow {
  id: string
  room_id: string
  question_index: number
  quiz_id: string
  question: string
  answer: string
  points: number
  hint: string | null
  image_url: string | null
}

export type LiveAnswerStatus = 'pending' | 'correct' | 'wrong'

export interface LiveAnswerRow {
  id: string
  room_id: string
  player_id: string
  question_index: number
  answer_text: string
  wager: number
  status: LiveAnswerStatus
  points: number
  reviewed_by_host: boolean
  reviewed_at: string | null
  created_at: string
}

export interface LiveStartQuestion {
  quiz_id: string
  question: string
  answer: string
  points: number
  hint?: string | null
  imageUrl?: string | null
}

export interface LiveGameSettings {
  questionCount: number
  questionTimeSeconds: number
  minWager: number
  maxWager: number
  deductOnWrong: boolean
  maxPlayers: number
  whoCanJoin: string
}

export const DEFAULT_LIVE_SETTINGS: LiveGameSettings = {
  questionCount: 10,
  questionTimeSeconds: 30,
  minWager: 1,
  maxWager: 20,
  deductOnWrong: false,
  maxPlayers: 10,
  whoCanJoin: 'anyone',
}

export function getWagerRange(min: number, max: number): number[] {
  const lo = Math.max(1, Math.round(min))
  const hi = Math.max(lo, Math.round(max))
  const values: number[] = []
  for (let value = lo; value <= hi; value += 1) values.push(value)
  return values
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}

// ---------------------------------------------------------------------------
// Room lifecycle (RPCs)
// ---------------------------------------------------------------------------

export async function createLiveRoom(
  packId: string,
  settings: Partial<LiveGameSettings> = {},
  previousRoomId?: string | null,
): Promise<string> {
  const supabase = getSupabaseClient()
  const merged: LiveGameSettings = { ...DEFAULT_LIVE_SETTINGS, ...settings }
  const { data, error } = await supabase.rpc('live_create_room', {
    p_pack_id: packId,
    p_max_players: merged.maxPlayers,
    p_question_timeout_seconds: merged.questionTimeSeconds,
    p_question_count: merged.questionCount,
    p_min_wager: merged.minWager,
    p_max_wager: settings.maxWager ?? null,
    p_deduct_on_wrong: merged.deductOnWrong,
    p_previous_room_id: previousRoomId ?? null,
    p_who_can_join: settings.whoCanJoin ?? 'anyone',
  })
  if (error) {
    console.error('[createLiveRoom] FAILED:', JSON.stringify(error, null, 2))
    throw new Error(errorMessage(error, 'Could not create room.'))
  }
  console.log('[createLiveRoom] SUCCESS — roomId:', data)
  return data as string
}

export async function updateLiveRoomSettings(
  roomId: string,
  settings: Partial<LiveGameSettings>,
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_update_settings', {
    p_room_id: roomId,
    p_question_count: settings.questionCount ?? null,
    p_question_timeout_seconds: settings.questionTimeSeconds ?? null,
    p_min_wager: settings.minWager ?? null,
    p_max_wager: settings.maxWager ?? null,
    p_deduct_on_wrong: settings.deductOnWrong ?? null,
    p_max_players: settings.maxPlayers ?? null,
  })
  if (error) throw new Error(errorMessage(error, 'Could not save settings.'))
}

export async function joinLiveRoom(roomCode: string, playerName: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_join_room', {
    p_room_code: roomCode,
    p_player_name: playerName,
  })
  if (error) throw new Error(errorMessage(error, 'Could not join room.'))
  return data as string
}

export async function rejoinLiveRoom(roomCode: string, previousRoomId: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_rejoin_room', {
    p_room_code: roomCode,
    p_previous_room_id: previousRoomId,
  })
  if (error) throw new Error(errorMessage(error, 'Could not rejoin.'))
  return data as string
}

export async function markLiveConnected(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_mark_connected', { p_room_id: roomId })
  if (error) console.warn('[live] heartbeat failed', error.message)
}

export async function sweepLiveStale(roomId: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_sweep_stale', { p_room_id: roomId })
  if (error) { console.warn('[live] sweep failed', error.message); return null }
  return (data as string | null) ?? null
}

export async function startLiveGame(roomId: string, questions: LiveStartQuestion[]): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_start_game', {
    p_room_id: roomId,
    p_questions: questions.map((question) => ({ ...question, image_url: question.imageUrl ?? null })),
  })
  if (error) throw new Error(errorMessage(error, 'Could not start game.'))
}

export async function closeLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_close_question', { p_room_id: roomId })
  if (error) console.warn('[live] close question failed', error.message)
}

export async function submitLiveAnswer(roomId: string, questionIndex: number, answerText: string, wager: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_submit_answer', {
    p_room_id: roomId,
    p_question_index: questionIndex,
    p_answer_text: answerText,
    p_wager: wager,
  })
  if (error) throw new Error(errorMessage(error, 'Could not submit answer.'))
}

export async function reviewLiveAnswer(
  roomId: string,
  playerId: string,
  questionIndex: number,
  status: 'correct' | 'wrong',
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_review_answer', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_question_index: questionIndex,
    p_status: status,
  })
  if (error) throw new Error(errorMessage(error, 'Could not grade answer.'))
}

export async function nextLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_next_question', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not advance question.'))
}

export async function previousLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_previous_question', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not go back.'))
}

export async function finishLiveGame(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_finish_game', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not finish game.'))
}

export async function transferLiveHost(roomId: string, newHostPlayerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_transfer_host', {
    p_room_id: roomId,
    p_new_host_player_id: newHostPlayerId,
  })
  if (error) throw new Error(errorMessage(error, 'Could not transfer host.'))
}

export async function deleteLiveRoom(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_delete_room', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not delete room.'))
}

// ---------------------------------------------------------------------------
// NEW: Game-loop RPCs (migration 033)
// ---------------------------------------------------------------------------

/** Advance the game phase (host only). Triggers the next UI state. */
export async function advanceGamePhase(roomId: string, phase: GamePhase): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_advance_phase', {
    p_room_id: roomId,
    p_phase: phase,
  })
  if (error) throw new Error(errorMessage(error, 'Could not advance phase.'))
}

/** Auto-close answers and grade all pending answers (host only, called when timer expires). */
export async function closeAndGrade(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_close_and_grade', {
    p_room_id: roomId,
  })
  if (error) throw new Error(errorMessage(error, 'Could not close and grade.'))
}

/** Host confirms scoring — applies final scores after review. */
export async function confirmScoring(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_confirm_scoring', {
    p_room_id: roomId,
  })
  if (error) throw new Error(errorMessage(error, 'Could not confirm scoring.'))
}

/** Host overrides a specific player's grade after auto-grading. */
export async function overrideGrade(
  roomId: string,
  playerId: string,
  questionIndex: number,
  status: 'correct' | 'wrong',
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_override_grade', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_question_index: questionIndex,
    p_status: status,
  })
  if (error) throw new Error(errorMessage(error, 'Could not override grade.'))
}

/** Skip the current question without scoring. */
export async function skipQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_skip_question', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not skip question.'))
}

/** Pause the game (host only). */
export async function pauseGame(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_pause_game', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not pause game.'))
}

/** Resume the game from pause (host only). */
export async function resumeGame(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_resume_game', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'Could not resume game.'))
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getLiveRoom(roomId: string): Promise<LiveRoomRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('live_pack_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()
  if (error) return null
  return (data as LiveRoomRow | null) ?? null
}

export async function getLivePlayers(roomId: string): Promise<LivePlayerRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('live_pack_players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
  if (error) return []
  return (data ?? []) as LivePlayerRow[]
}

export async function getLiveQuestions(roomId: string): Promise<LiveQuestionRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('live_pack_questions')
    .select('*')
    .eq('room_id', roomId)
    .order('question_index', { ascending: true })
  if (error) return []
  return (data ?? []) as LiveQuestionRow[]
}

export async function getLiveAnswers(roomId: string): Promise<LiveAnswerRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('live_pack_answers')
    .select('*')
    .eq('room_id', roomId)
    .order('question_index', { ascending: true })
  if (error) return []
  return (data ?? []) as LiveAnswerRow[]
}

// ---------------------------------------------------------------------------
// Completed-round history (migration 029)
// ---------------------------------------------------------------------------

export interface LiveRoundHistoryPlayer {
  name: string
  score: number
  correct_count: number
  wrong_count: number
  avg_wager: number
  best_win_wager: number
}

export interface LiveRoundHistoryRow {
  id: string
  room_id: string
  pack_id: string
  pack_title: string
  host_name: string
  question_count: number
  deduct_on_wrong: boolean
  finished_at: string
  winner_name: string | null
  winner_score: number | null
  players: LiveRoundHistoryPlayer[]
}

export async function getLiveRoundHistory(packId: string): Promise<LiveRoundHistoryRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_get_round_history', { p_pack_id: packId })
  if (error) { console.warn('[live] round history failed', error.message); return [] }
  return (data ?? []) as LiveRoundHistoryRow[]
}

export async function getLiveRoundHistoryByRoom(roomId: string): Promise<LiveRoundHistoryRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_get_round_history_by_room', { p_room_id: roomId })
  if (error) return null
  return (data ?? null) as LiveRoundHistoryRow
}

// ---------------------------------------------------------------------------
// Question resolution (host side, before live_start_game)
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates (Knuth) shuffle — unbiased random permutation.
 * Mutates the array in place and returns it.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

/**
 * Resolve questions for a live game from a Pack.
 *
 * 1. Fetches ALL questions from pack_questions using pack_id (direct, no quiz intermediary).
 * 2. Shuffles them randomly using Fisher-Yates.
 * 3. Takes the first N (questionCount).
 * 4. Returns in the randomized order — this order is stored in the room and used for the game.
 *
 * The randomization happens ONCE at game creation. The stored order persists
 * across refreshes, reconnects, and component re-renders.
 */
export async function resolveLivePackQuestions(pack: { id: string; quizzes?: Array<{ quiz_id: string }> }, questionCount?: number): Promise<LiveStartQuestion[]> {
  const supabase = getSupabaseClient()

  // Step 1: Fetch ALL questions directly from pack_questions using pack_id
  const { data: packQuestions, error } = await supabase
    .from('pack_questions')
    .select('id, question, answer, points, hint, image_url')
    .eq('pack_id', pack.id)
    .order('position', { ascending: true })

  if (error) {
    console.error('[resolveLivePackQuestions] Error fetching pack_questions:', JSON.stringify(error))
    throw new Error('Could not load pack questions.')
  }

  if (!packQuestions || packQuestions.length === 0) {
    // Fallback: try legacy quiz-based resolution for old packs
    return resolveLegacyPackQuestions(pack, questionCount)
  }

  // Step 2: Convert to LiveStartQuestion format
  const resolved: LiveStartQuestion[] = packQuestions.map((pq) => ({
    quiz_id: '',
    question: pq.question,
    answer: pq.answer,
    points: pq.points,
    hint: pq.hint ?? null,
    imageUrl: pq.image_url ?? null,
  }))

  // Step 3: Shuffle randomly (Fisher-Yates)
  shuffleArray(resolved)

  console.log(`[resolveLivePackQuestions] Resolved ${resolved.length} questions from pack ${pack.id}, shuffled.`)

  // Step 4: Take the requested number
  if (questionCount && questionCount > 0 && resolved.length > questionCount) {
    return resolved.slice(0, questionCount)
  }
  return resolved
}

/**
 * Legacy fallback: resolve questions from pack_quizzes (old intermediary architecture).
 * Only used for packs that have no direct pack_questions but do have pack_quizzes.
 */
async function resolveLegacyPackQuestions(pack: { id: string; quizzes?: Array<{ quiz_id: string }> }, questionCount?: number): Promise<LiveStartQuestion[]> {
  await ensureLocalQuestionsLoaded()
  const resolved: LiveStartQuestion[] = []
  for (const quiz of (pack.quizzes ?? [])) {
    let questions: Array<{ question: string; answer: string; points: number; hint?: string; media?: string; mediaType?: 'image' | 'video' | 'career' }> = []
    if (isCustomQuizId(quiz.quiz_id)) {
      const uuid = quiz.quiz_id.slice('custom:'.length)
      const rows = await listLegacyQuizQuestions(uuid)
      questions = rows.map((q) => ({
        question: q.question,
        answer: q.answer,
        hint: q.hint ?? undefined,
        media: q.image_url ?? undefined,
        mediaType: q.image_url ? 'image' : undefined,
        points: q.points,
      }))
    } else {
      questions = buildLegacyQuizQuestions(quiz.quiz_id)
    }
    for (const question of questions) {
      resolved.push({
        quiz_id: quiz.quiz_id,
        question: question.question,
        answer: question.answer,
        points: question.points,
        hint: question.hint ?? null,
        imageUrl: question.mediaType === 'image' ? question.media : null,
      })
    }
  }
  // Also shuffle legacy questions
  shuffleArray(resolved)
  if (questionCount && questionCount > 0 && resolved.length > questionCount) {
    return resolved.slice(0, questionCount)
  }
  return resolved
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

export interface LiveRealtimeCallbacks {
  onRoomChange?: (room: LiveRoomRow) => void
  onPlayersChange?: (players: LivePlayerRow[]) => void
  onQuestionsChange?: (questions: LiveQuestionRow[]) => void
  onAnswersChange?: (answers: LiveAnswerRow[]) => void
  onStatusChange?: (status: string) => void
}

export function subscribeToLiveRoom(
  roomId: string,
  callbacks: LiveRealtimeCallbacks,
): () => void {
  const supabase = getSupabaseClient()
  const channel: RealtimeChannel = supabase.channel(`live-pack:${roomId}`)

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_pack_rooms', filter: `id=eq.${roomId}` },
      () => {
        void getLiveRoom(roomId).then((room) => {
          if (room) callbacks.onRoomChange?.(room)
        })
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_pack_players', filter: `room_id=eq.${roomId}` },
      () => {
        void getLivePlayers(roomId).then(callbacks.onPlayersChange)
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_pack_questions', filter: `room_id=eq.${roomId}` },
      () => {
        void getLiveQuestions(roomId).then(callbacks.onQuestionsChange)
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_pack_answers', filter: `room_id=eq.${roomId}` },
      () => {
        void getLiveAnswers(roomId).then(callbacks.onAnswersChange)
      },
    )
    .subscribe((status) => callbacks.onStatusChange?.(status))

  return () => {
    void supabase.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// Shared countdown (derived from the database)
// ---------------------------------------------------------------------------

export function getLiveQuestionRemainingMs(room: Pick<LiveRoomRow, 'status' | 'question_started_at' | 'question_timeout_seconds'>): number | null {
  if (room.status !== 'playing' || !room.question_started_at) return null
  const deadline = new Date(room.question_started_at).getTime() + room.question_timeout_seconds * 1000
  return Math.max(0, deadline - Date.now())
}

// ---------------------------------------------------------------------------
// Party system: Chat, Ready, Public Lobbies (migration 039)
// ---------------------------------------------------------------------------

export interface PublicLobby {
  room_id: string
  room_code: string
  host_name: string
  host_avatar_url: string | null
  pack_title: string
  pack_cover_url: string | null
  player_count: number
  max_players: number
  created_at: string
}

export interface ChatMessage {
  id: string
  player_name: string
  message: string
  is_system: boolean
  created_at: string
}

/** Fetch public lobbies (who_can_join = 'anyone', status = 'lobby'). */
export async function listPublicLobbies(): Promise<PublicLobby[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_list_public_lobbies')
  if (error) { console.warn('[live] public lobbies failed', error.message); return [] }
  return (data ?? []) as PublicLobby[]
}

/** Toggle ready status for the current player. */
export async function setReady(roomId: string, ready: boolean): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_set_ready', {
    p_room_id: roomId,
    p_ready: ready,
  })
  if (error) throw new Error(errorMessage(error, 'Could not update ready status.'))
}

/** Send a chat message. */
export async function sendChat(roomId: string, message: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_send_chat', {
    p_room_id: roomId,
    p_message: message,
  })
  if (error) throw new Error(errorMessage(error, 'Could not send message.'))
}

/** Fetch chat messages (optionally since a timestamp). */
export async function getChat(roomId: string, since?: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_get_chat', {
    p_room_id: roomId,
    p_since: since ?? null,
  })
  if (error) { console.warn('[live] chat fetch failed', error.message); return [] }
  return (data ?? []) as ChatMessage[]
}

/** Match a grid answer against accepted answers for a list-type question. */
export async function matchGridAnswer(
  roomId: string,
  questionId: string,
  answerText: string,
): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_match_grid_answer', {
    p_room_id: roomId,
    p_question_id: questionId,
    p_answer_text: answerText,
  })
  if (error) throw new Error(errorMessage(error, 'Could not match answer.'))
  return data as boolean
}

// ---------------------------------------------------------------------------
// Share helpers
// ---------------------------------------------------------------------------

export function liveRoomInviteUrl(roomCode: string, previousRoomId?: string | null): string {
  const base = window.location.origin
  const params = new URLSearchParams({ code: roomCode })
  if (previousRoomId) params.set('prev', previousRoomId)
  return `${base}/packs/live/join?${params.toString()}`
}

export async function copyLiveInvite(roomCode: string, previousRoomId?: string | null): Promise<boolean> {
  const url = liveRoomInviteUrl(roomCode, previousRoomId)
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    window.prompt('Invite link', url)
    return false
  }
}

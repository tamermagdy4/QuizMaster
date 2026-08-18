import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import { ensureLocalQuestionsLoaded } from '../data/questionLoader'
import { listQuestions } from './packQuizService'
import type { PackWithQuizzes } from '../types/packs'
import { isCustomQuizId } from '../types/packs'
import { buildQuizQuestions, type PlayableQuestion } from '../utils/packQuizzes'

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
  /** Host-chosen per-question timer in seconds (default 30). */
  question_timeout_seconds: number
  /** How many questions the host wants from the pack (5 / 10 / 20…). */
  question_count: number
  /** Wager range each player picks from, per question (default 1 → 20). */
  min_wager: number
  max_wager: number
  /** Wrong answers subtract the wager (true) or score 0 (false). */
  deduct_on_wrong: boolean
  /** When the current question opened — every client derives the same deadline. */
  question_started_at: string | null
  /** Explicit shared phase: active (accepting answers) → closed (ANSWERING_CLOSED). */
  question_phase: LiveQuestionPhase
  /** Replay rounds: the finished room this lobby continues after (migration 030). */
  previous_room_id: string | null
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
  /** End-of-round stats, aggregated on the shared row (identical for all). */
  wrong_count: number
  avg_wager: number
  best_win_wager: number
  joined_at: string
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
  /** The point value the player chose for this question (locked after send). */
  wager: number
  status: LiveAnswerStatus
  points: number
  reviewed_by_host: boolean
  reviewed_at: string | null
  created_at: string
}

/** Payload sent to live_start_game — one element per resolved question. */
export interface LiveStartQuestion {
  quiz_id: string
  question: string
  answer: string
  points: number
  hint?: string | null
  imageUrl?: string | null
}

/** Host round setup — every field optional when creating/updating. */
export interface LiveGameSettings {
  questionCount: number
  questionTimeSeconds: number
  minWager: number
  maxWager: number
  deductOnWrong: boolean
  maxPlayers: number
}

/** Default round setup (used when the host creates a game without options). */
export const DEFAULT_LIVE_SETTINGS: LiveGameSettings = {
  questionCount: 10,
  questionTimeSeconds: 30,
  minWager: 1,
  maxWager: 20,
  deductOnWrong: false,
  maxPlayers: 10,
}

/**
 * Every integer from min to max — the Sporcle rule: each player picks ANY
 * value up to the ceiling, and the ceiling equals the question count
 * (5 questions → 1..5, 10 → 1..10, 20 → 1..20).
 */
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

/**
 * Creates a room for a Pack and registers the caller as the host.
 * @param previousRoomId optional finished room id (a replay round) — lets the
 * new lobby show the previous round's final ranking (migration 030).
 */
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
    // NULL lets the database derive the ceiling from the question count
    // (Sporcle rule: max points = number of questions).
    p_max_wager: settings.maxWager ?? null,
    p_deduct_on_wrong: merged.deductOnWrong,
    p_previous_room_id: previousRoomId ?? null,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر إنشاء الغرفة.'))
  return data as string
}

/** Host changes the round setup while the room is still in the lobby. */
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
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ إعدادات الجولة.'))
}

/** Joins (or rejoins) a room by its short code. Returns the player id. */
export async function joinLiveRoom(roomCode: string, playerName: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_join_room', {
    p_room_code: roomCode,
    p_player_name: playerName,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر الانضمام إلى الغرفة.'))
  return data as string
}

/**
 * One-click group rejoin (migration 031): joins the NEW replay room using the
 * caller's identity (name/avatar) from the previous round — no name prompt.
 * Returns the player id.
 */
export async function rejoinLiveRoom(roomCode: string, previousRoomId: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_rejoin_room', {
    p_room_code: roomCode,
    p_previous_room_id: previousRoomId,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر العودة إلى الجولة.'))
  return data as string
}

/** Heartbeat — marks the caller as connected (call every ~8s). */
export async function markLiveConnected(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_mark_connected', { p_room_id: roomId })
  if (error) {
    // Non-fatal: presence is refreshed by the next heartbeat anyway.
    console.warn('[live] heartbeat failed', error.message)
  }
}

/**
 * Presence sweep — every client calls this on its heartbeat. Marks stale
 * players (no heartbeat for 30s) as offline, and when the host is offline it
 * AUTOMATICALLY promotes the most active connected player (highest score,
 * then most recent heartbeat, then earliest join). Returns the new host
 * player id, or null when nothing changed.
 */
export async function sweepLiveStale(roomId: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_sweep_stale', { p_room_id: roomId })
  if (error) {
    console.warn('[live] sweep failed', error.message)
    return null
  }
  return (data as string | null) ?? null
}

/** Starts the game with the resolved question list (host only, atomically). */
export async function startLiveGame(roomId: string, questions: LiveStartQuestion[]): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_start_game', {
    p_room_id: roomId,
    p_questions: questions.map((question) => ({ ...question, image_url: question.imageUrl ?? null })),
  })
  if (error) throw new Error(errorMessage(error, 'تعذر بدء اللعبة.'))
}

/** Flips the shared per-question phase to 'closed' (ANSWERING_CLOSED). */
export async function closeLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_close_question', { p_room_id: roomId })
  if (error) console.warn('[live] close question failed', error.message)
}

/** Submits the caller's answer (with their chosen wager) for the current question. */
export async function submitLiveAnswer(roomId: string, questionIndex: number, answerText: string, wager: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_submit_answer', {
    p_room_id: roomId,
    p_question_index: questionIndex,
    p_answer_text: answerText,
    p_wager: wager,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر إرسال الإجابة.'))
}

/** Host grades one player's answer for the given question (correct / wrong). */
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
  if (error) throw new Error(errorMessage(error, 'تعذر اعتماد الإجابة.'))
}

/** Host advances everyone to the next question. */
export async function nextLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_next_question', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'تعذر الانتقال للسؤال التالي.'))
}

/** Host goes back one question. */
export async function previousLiveQuestion(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_previous_question', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'تعذر الرجوع للسؤال السابق.'))
}

/** Host ends the game — everyone sees the final leaderboard. */
export async function finishLiveGame(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_finish_game', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'تعذر إنهاء اللعبة.'))
}

/** Transfers hosting to another player (host offline, or before start). */
export async function transferLiveHost(roomId: string, newHostPlayerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_transfer_host', {
    p_room_id: roomId,
    p_new_host_player_id: newHostPlayerId,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر نقل صلاحيات المضيف.'))
}

/** Host deletes the room (cancels). Cascades to players/questions/answers. */
export async function deleteLiveRoom(roomId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('live_delete_room', { p_room_id: roomId })
  if (error) throw new Error(errorMessage(error, 'تعذر حذف الغرفة.'))
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

/** Answers the current user may read: their own + everything for the host. */
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

/** One entry of the final-standings snapshot stored on a finished round. */
export interface LiveRoundHistoryPlayer {
  name: string
  score: number
  correct_count: number
  wrong_count: number
  avg_wager: number
  best_win_wager: number
}

/** A finished round snapshot — lets host and players reopen earlier results. */
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

/** All finished rounds of a pack, newest first. */
export async function getLiveRoundHistory(packId: string): Promise<LiveRoundHistoryRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_get_round_history', { p_pack_id: packId })
  if (error) {
    console.warn('[live] round history failed', error.message)
    return []
  }
  return (data ?? []) as LiveRoundHistoryRow[]
}

/** Single finished round by room id (e.g. the round that just finished). */
export async function getLiveRoundHistoryByRoom(roomId: string): Promise<LiveRoundHistoryRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('live_get_round_history_by_room', { p_room_id: roomId })
  if (error) return null
  return (data ?? null) as LiveRoundHistoryRow | null
}

// ---------------------------------------------------------------------------
// Question resolution (host side, before live_start_game)
// ---------------------------------------------------------------------------

/**
 * Builds the full ordered question list of a Pack for the live game.
 * Custom quizzes come from pack_questions (Supabase); existing category
 * quizzes go through the SAME questionLoader the game board uses.
 */
export async function resolveLivePackQuestions(pack: PackWithQuizzes, questionCount?: number): Promise<LiveStartQuestion[]> {
  await ensureLocalQuestionsLoaded()
  const resolved: LiveStartQuestion[] = []
  for (const quiz of pack.quizzes) {
    let questions: PlayableQuestion[] = []
    if (isCustomQuizId(quiz.quiz_id)) {
      const uuid = quiz.quiz_id.slice('custom:'.length)
      const rows = await listQuestions(uuid)
      questions = rows.map<PlayableQuestion>((question) => ({
        question: question.question,
        answer: question.answer,
        hint: question.hint ?? undefined,
        media: question.image_url ?? undefined,
        mediaType: question.image_url ? 'image' : undefined,
        points: question.points,
      }))
    } else {
      questions = buildQuizQuestions(quiz.quiz_id)
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
  // The host-chosen question count caps the SAME ordered list for everyone.
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

/**
 * Subscribes to every shared piece of a live room. Any change refetches the
 * affected resource — the database stays the single source of truth and the
 * client never guesses state. Returns an unsubscribe function.
 */
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
// Shared countdown (derived from the database — same for every client)
// ---------------------------------------------------------------------------

/**
 * Milliseconds left for the current question, or null when no question is
 * open (lobby / finished / not started). Every client computes the same value
 * from question_started_at + question_timeout_seconds, so the countdown is
 * inherently synchronized without sharing any client clock.
 */
export function getLiveQuestionRemainingMs(room: Pick<LiveRoomRow, 'status' | 'question_started_at' | 'question_timeout_seconds'>): number | null {
  if (room.status !== 'playing' || !room.question_started_at) return null
  const deadline = new Date(room.question_started_at).getTime() + room.question_timeout_seconds * 1000
  return Math.max(0, deadline - Date.now())
}

// ---------------------------------------------------------------------------
// Share helpers
// ---------------------------------------------------------------------------

/**
 * Absolute invite URL for a room code. When previousRoomId is given, the link
 * carries &prev=… so returning players rejoin with their previous identity in
 * one click (migration 031).
 */
export function liveRoomInviteUrl(roomCode: string, previousRoomId?: string | null): string {
  const base = window.location.origin
  const params = new URLSearchParams({ code: roomCode })
  if (previousRoomId) params.set('prev', previousRoomId)
  return `${base}/packs/live/join?${params.toString()}`
}

/** Copies the invite (rejoin) link to the clipboard (falls back to prompt). */
export async function copyLiveInvite(roomCode: string, previousRoomId?: string | null): Promise<boolean> {
  const url = liveRoomInviteUrl(roomCode, previousRoomId)
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    window.prompt('رابط الدعوة', url)
    return false
  }
}

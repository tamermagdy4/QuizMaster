/**
 * Fresh live room (host + player, Q1 graded) with BOTH sessions saved so the
 * browser can test the player view. Writes public/.ui-debug3.json.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
if (!url || !anon) throw new Error('Supabase env missing')

const stamp = Date.now().toString(36)
const admin = createClient(url, anon)

async function signUp(email, name) {
  const password = process.env.E2E_TEST_PASSWORD
  if (!password) {
    throw new Error('E2E_TEST_PASSWORD is required')
  }
  const { data, error } = await admin.auth.signUp({
    email, password, options: { data: { name } },
  })
  if (error || !data.session) throw new Error('signUp failed: ' + error?.message)
  const c = createClient(url, anon)
  await c.auth.setSession(data.session)
  return c
}

const hostC = await signUp(`dbg3-host-${stamp}@test.local`, 'منى المضيفة')
const playerC = await signUp(`dbg3-player-${stamp}@test.local`, 'سالم اللاعب')
const hostSession = (await hostC.auth.getSession()).data.session
const playerSession = (await playerC.auth.getSession()).data.session

const { data: packs } = await admin.from('packs').select('id').eq('status', 'published').order('created_at', { ascending: false }).limit(5)
const pack = packs[0]

const { data: roomId, error: re } = await hostC.rpc('live_create_room', {
  p_pack_id: pack.id, p_max_players: 20, p_question_timeout_seconds: 300,
  p_question_count: 10, p_min_wager: 1, p_max_wager: null, p_deduct_on_wrong: false,
})
if (re) throw new Error('create: ' + re.message)

const { data: roomRow0 } = await hostC.from('live_pack_rooms').select('room_code').eq('id', roomId).single()
const { data: joinedPlayerId, error: je } = await playerC.rpc('live_join_room', {
  p_room_code: roomRow0.room_code, p_player_name: 'سالم اللاعب',
})
if (je) throw new Error('join: ' + je.message)

const { data: players0 } = await hostC.from('live_pack_players').select('id').eq('room_id', roomId)
const hostPlayerId = players0.find((p) => p.id !== joinedPlayerId)?.id ?? players0[0].id

const { data: questions, error: qe } = await admin
  .from('pack_questions')
  .select('id, quiz_id, question, answer, hint, image_url, pack_custom_quizzes!inner(pack_id)')
  .eq('pack_custom_quizzes.pack_id', pack.id)
  .order('position', { ascending: true })
  .limit(10)
if (qe || !questions?.length) throw new Error('questions: ' + (qe?.message ?? 'none'))

const qs = questions.slice(0, 10).map((q, i) => ({
  quiz_id: q.quiz_id, question_index: i, question: q.question, answer: q.answer,
  points: 100, hint: q.hint ?? null, image_url: q.image_url ?? null,
}))

const { error: se } = await hostC.rpc('live_start_game', { p_room_id: roomId, p_questions: qs })
if (se) throw new Error('start: ' + se.message)

await hostC.rpc('live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'إجابة المضيف', p_wager: 8 })
await playerC.rpc('live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'إجابة اللاعب', p_wager: 5 })
await hostC.rpc('live_review_answer', { p_room_id: roomId, p_player_id: joinedPlayerId, p_question_index: 0, p_status: 'wrong' })
await hostC.rpc('live_review_answer', { p_room_id: roomId, p_player_id: hostPlayerId, p_question_index: 0, p_status: 'correct' })

writeFileSync(
  'public/.ui-debug3.json',
  JSON.stringify({ hostSession, playerSession, roomId, roomCode: roomRow0.room_code }),
  'utf8',
)
console.log(JSON.stringify({ roomId, roomCode: roomRow0.room_code }, null, 2))

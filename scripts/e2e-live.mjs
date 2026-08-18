// Full E2E for the Live Pack multiplayer system (migration 015).
// Exercises the same RPCs + RLS the app uses, with three real accounts.
import { readFileSync } from 'node:fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const match = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.log(`  ✗ ${label} ${detail}`)
  }
}

const rest = (path, { token = ANON, method = 'GET', body, headers = {} } = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`signup failed: ${JSON.stringify(json)}`)
  return { token: json.access_token, id: json.user.id }
}

const rpc = async (token, fn, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* void */ }
  return { status: res.status, data, text }
}

const stamp = Date.now()
console.log('— signup accounts —')
const A = await signUp(`liveA-${stamp}@test.local`, 'password123')
const B = await signUp(`liveB-${stamp}@test.local`, 'password123')
const C = await signUp(`liveC-${stamp}@test.local`, 'password123')
check('host A signed up', Boolean(A.token))
check('player B signed up', Boolean(B.token))
check('player C signed up', Boolean(C.token))

// Find a published pack.
const packsRes = await rest('/packs?status=eq.published&visibility=eq.public&select=id,title&limit=5', { token: A.token })
const packs = await packsRes.json()
check('a published pack exists', packs.length > 0)
const packId = packs[0].id

console.log('— room lifecycle —')
const created = await rpc(A.token, 'live_create_room', { p_pack_id: packId })
check('A creates room', created.status === 200 && typeof created.data === 'string', created.text)
const roomId = created.data
const roomRow = (await (await rest(`/live_pack_rooms?select=*&id=eq.${roomId}`, { token: A.token })).json())[0]
check('room has a 6-char code', /^[A-Z0-9]{6}$/.test(roomRow.room_code), roomRow.room_code)
check('room starts in lobby', roomRow.status === 'lobby')
check('wager ceiling follows the question count (10 questions → max 10)', roomRow.max_wager === 10 && roomRow.question_count === 10, JSON.stringify({ max: roomRow.max_wager, count: roomRow.question_count }))
check('wrong answers score 0 by default (no deduction)', roomRow.deduct_on_wrong === false)

// Sporcle rule: the max a player can wager equals the question count, and it
// tracks the count when the host changes it in the lobby (explicit max wins).
const derived = await rpc(A.token, 'live_create_room', { p_pack_id: packId, p_question_count: 5 })
const derivedId = derived.data
let derivedRow = (await (await rest(`/live_pack_rooms?select=question_count,max_wager,min_wager&id=eq.${derivedId}`, { token: A.token })).json())[0]
check('5 questions → max wager 5', derivedRow.max_wager === 5 && derivedRow.question_count === 5, JSON.stringify(derivedRow))
await rpc(A.token, 'live_update_settings', { p_room_id: derivedId, p_question_count: 20 })
derivedRow = (await (await rest(`/live_pack_rooms?select=question_count,max_wager&id=eq.${derivedId}`, { token: A.token })).json())[0]
check('changing to 20 questions raises the ceiling to 20', derivedRow.max_wager === 20, JSON.stringify(derivedRow))
await rpc(A.token, 'live_update_settings', { p_room_id: derivedId, p_max_wager: 7 })
derivedRow = (await (await rest(`/live_pack_rooms?select=question_count,max_wager&id=eq.${derivedId}`, { token: A.token })).json())[0]
check('an explicit max wager still overrides the ceiling', derivedRow.max_wager === 7, JSON.stringify(derivedRow))
await rpc(A.token, 'live_update_settings', { p_room_id: derivedId, p_question_count: 10 })
derivedRow = (await (await rest(`/live_pack_rooms?select=question_count,max_wager&id=eq.${derivedId}`, { token: A.token })).json())[0]
check('a later count change re-derives the ceiling (10)', derivedRow.max_wager === 10, JSON.stringify(derivedRow))
const derivedDel = await rpc(A.token, 'live_delete_room', { p_room_id: derivedId })
check('derived room cleaned up', derivedDel.status === 204, derivedDel.text)

const bJoin = await rpc(B.token, 'live_join_room', { p_room_code: roomRow.room_code, p_player_name: 'Basha' })
check('B joins by code', bJoin.status === 200 && typeof bJoin.data === 'string', bJoin.text)
const bPlayerId = bJoin.data
const cJoin = await rpc(C.token, 'live_join_room', { p_room_code: roomRow.room_code, p_player_name: 'Carol' })
check('C joins by code', cJoin.status === 200 && typeof cJoin.data === 'string', cJoin.text)
const cPlayerId = cJoin.data

const badJoin = await rpc(B.token, 'live_join_room', { p_room_code: 'ZZZZZZ', p_player_name: 'X' })
check('join with bad code rejected', badJoin.status === 400)

// Question timer: host sets 60s; non-host rejected; room reflects it.
const badTimeout = await rpc(B.token, 'live_set_timeout', { p_room_id: roomId, p_seconds: 60 })
check('non-host cannot set the timer', badTimeout.status === 400 && badTimeout.text.includes('host'))
const setT = await rpc(A.token, 'live_set_timeout', { p_room_id: roomId, p_seconds: 60 })
check('host sets timer to 60s', setT.status === 204, setT.text)
const roomTimer = (await (await rest(`/live_pack_rooms?select=question_timeout_seconds&id=eq.${roomId}`, { token: A.token })).json())[0]
check('room reflects 60s timeout', roomTimer.question_timeout_seconds === 60, JSON.stringify(roomTimer))

// A player cannot start the game (host only).
const badStart = await rpc(B.token, 'live_start_game', { p_room_id: roomId, p_questions: [{ question: 'q', answer: 'a' }] })
check('non-host cannot start', badStart.status === 400 && badStart.text.includes('host'))

console.log('— start + shared question —')
const questions = [
  { quiz_id: 'custom:test', question: 'ما هي عاصمة مصر؟', answer: 'القاهرة', points: 100, hint: '' },
  { quiz_id: 'custom:test', question: 'كم عدد أيام الأسبوع؟', answer: 'سبعة', points: 300, hint: '' },
  { quiz_id: 'custom:test', question: 'أكبر محيط في العالم؟', answer: 'الهادئ', points: 500, hint: '' },
]
const started = await rpc(A.token, 'live_start_game', { p_room_id: roomId, p_questions: questions })
check('A starts the game', started.status === 204, started.text)
const qRows = await (await rest(`/live_pack_questions?select=question_index,question,points&room_id=eq.${roomId}&order=question_index.asc`, { token: B.token })).json()
check('players see the resolved questions', qRows.length === 3)
const roomAfterStart = (await (await rest(`/live_pack_rooms?select=status,current_question_index,question_started_at&id=eq.${roomId}`, { token: B.token })).json())[0]
check('room is playing at question 0', roomAfterStart.status === 'playing' && roomAfterStart.current_question_index === 0)
check('question clock opens at start', Boolean(roomAfterStart.question_started_at))

console.log('— answers + host review —')
// B answers with a 10-point wager (the ceiling for a 10-question room); C with 5.
const subB = await rpc(B.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'القاهرة', p_wager: 10 })
check('B submits answer (wager 10)', subB.status === 204, subB.text)
const subC = await rpc(C.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'الإسكندرية', p_wager: 5 })
check('C submits answer (wager 5)', subC.status === 204, subC.text)

// Wager outside the room's range is rejected server-side.
const badWager = await rpc(B.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'x', p_wager: 999 })
check('out-of-range wager rejected', badWager.status === 400 && badWager.text.includes('Wager'))

// Submitting for a FUTURE question is rejected (must match current index).
const futureSub = await rpc(B.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 2, p_answer_text: 'x', p_wager: 5 })
check('future question submission rejected', futureSub.status === 400)

// RLS: B can only see their own answer; the host sees both.
const answersAsB = await (await rest(`/live_pack_answers?select=player_id,answer_text,status&room_id=eq.${roomId}`, { token: B.token })).json()
check('B sees only their own answer', answersAsB.length === 1 && answersAsB[0].player_id === bPlayerId, JSON.stringify(answersAsB))
const answersAsA = await (await rest(`/live_pack_answers?select=player_id,answer_text,status&room_id=eq.${roomId}`, { token: A.token })).json()
check('host sees all answers', answersAsA.length === 2)

// Host reviews: B correct (+100), C wrong (0).
const revB = await rpc(A.token, 'live_review_answer', { p_room_id: roomId, p_player_id: bPlayerId, p_question_index: 0, p_status: 'correct' })
check('host grades B correct', revB.status === 204, revB.text)
const revC = await rpc(A.token, 'live_review_answer', { p_room_id: roomId, p_player_id: cPlayerId, p_question_index: 0, p_status: 'wrong' })
check('host grades C wrong', revC.status === 204, revC.text)

const players1 = await (await rest(`/live_pack_players?select=name,score,correct_count&room_id=eq.${roomId}&order=joined_at.asc`, { token: A.token })).json()
const b1 = players1.find((p) => p.name === 'Basha')
const c1 = players1.find((p) => p.name === 'Carol')
check('B got +10 (his wager)', b1 && b1.score === 10, JSON.stringify(players1))
check('C wrong scores 0 (no deduction by default)', c1 && c1.score === 0, JSON.stringify(players1))

// Answers carry the wager; B cannot change it after sending.
const bWagerRow = (await (await rest(`/live_pack_answers?select=wager,answer_text&room_id=eq.${roomId}&player_id=eq.${bPlayerId}&question_index=eq.0`, { token: A.token })).json())[0]
check('B answer stores wager 10', bWagerRow && bWagerRow.wager === 10)
const reSub = await rpc(B.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'القاهرة (edited)', p_wager: 5 })
check('B re-submits (edit answer)', reSub.status === 204, reSub.text)
const bWagerAfter = (await (await rest(`/live_pack_answers?select=wager,answer_text&room_id=eq.${roomId}&player_id=eq.${bPlayerId}&question_index=eq.0`, { token: A.token })).json())[0]
check('wager stays locked at 10 after edit', bWagerAfter && bWagerAfter.wager === 10 && bWagerAfter.answer_text === 'القاهرة (edited)')

// Flip B to wrong → 0 (no deduction by default); back to correct → restored.
await rpc(A.token, 'live_review_answer', { p_room_id: roomId, p_player_id: bPlayerId, p_question_index: 0, p_status: 'wrong' })
const bWrong = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${bPlayerId}`, { token: A.token })).json())[0]
check('flip to wrong scores 0 (no deduction)', bWrong.score === 0 && bWrong.correct_count === 0)
await rpc(A.token, 'live_review_answer', { p_room_id: roomId, p_player_id: bPlayerId, p_question_index: 0, p_status: 'correct' })
const bRestored = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${bPlayerId}`, { token: A.token })).json())[0]
check('flip back restores +10', bRestored.score === 10 && bRestored.correct_count === 1)

// Round settings are lobby-only — changing them mid-game must be rejected.
const settingsRes = await rpc(A.token, 'live_update_settings', { p_room_id: roomId, p_deduct_on_wrong: false })
check('settings change while playing rejected (lobby only)', settingsRes.status === 400 && settingsRes.text.includes('before the game starts'))

// A player cannot grade answers.
const badReview = await rpc(B.token, 'live_review_answer', { p_room_id: roomId, p_player_id: bPlayerId, p_question_index: 0, p_status: 'correct' })
check('player cannot grade', badReview.status === 400 && badReview.text.includes('host'))

console.log('— next question —')
await rpc(A.token, 'live_next_question', { p_room_id: roomId })
const roomQ1 = (await (await rest(`/live_pack_rooms?select=current_question_index,status&id=eq.${roomId}`, { token: B.token })).json())[0]
check('all players move together to Q2', roomQ1.current_question_index === 1 && roomQ1.status === 'playing')
const myAnswersQ1 = await (await rest(`/live_pack_answers?select=question_index&room_id=eq.${roomId}&player_id=eq.${bPlayerId}`, { token: B.token })).json()
check('answers for new question reset', !myAnswersQ1.some((a) => a.question_index === 1))

// The host is ALSO a player: they pick a value, answer, and get graded like
// everyone else (host = player + host controls, never a spectator).
const hostAsPlayerRow = (await (await rest(`/live_pack_players?select=id&room_id=eq.${roomId}&user_id=eq.${A.id}`, { token: A.token })).json())[0]
const hostSub = await rpc(A.token, 'live_submit_answer', { p_room_id: roomId, p_question_index: 1, p_answer_text: 'سبعة', p_wager: 10 })
check('host submits their own answer (host is also a player)', hostSub.status === 204, hostSub.text)
await rpc(A.token, 'live_review_answer', { p_room_id: roomId, p_player_id: hostAsPlayerRow.id, p_question_index: 1, p_status: 'correct' })
const hostAfter = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${hostAsPlayerRow.id}`, { token: A.token })).json())[0]
check('host answer graded and scored like any player (+10)', hostAfter.score === 10 && hostAfter.correct_count === 1, JSON.stringify(hostAfter))

// End-of-round stats are aggregated on the shared player row (identical for
// every client despite the answers RLS) — correct/wrong counts, average
// wager, and the best winning wager.
const statsAll = await (await rest(`/live_pack_players?select=name,user_id,score,correct_count,wrong_count,avg_wager,best_win_wager&room_id=eq.${roomId}&order=joined_at.asc`, { token: B.token })).json()
const stB = statsAll.find((p) => p.name === 'Basha')
const stC = statsAll.find((p) => p.name === 'Carol')
const stA = statsAll.find((p) => p.user_id === A.id)
check('player (non-host) sees identical stats via shared row', statsAll.length === 3 && stB && stC && stA, JSON.stringify(statsAll))
check('B stats: 1 correct, 0 wrong, avg wager 10, best win 10', stB && stB.correct_count === 1 && stB.wrong_count === 0 && stB.avg_wager === 10 && stB.best_win_wager === 10, JSON.stringify(stB))
check('C stats: 0 correct, 1 wrong, avg wager 5, no best win', stC && stC.correct_count === 0 && stC.wrong_count === 1 && stC.avg_wager === 5 && stC.best_win_wager === 0, JSON.stringify(stC))
check('host stats: 1 correct, 0 wrong, avg wager 10, best win 10', stA && stA.correct_count === 1 && stA.wrong_count === 0 && stA.avg_wager === 10 && stA.best_win_wager === 10, JSON.stringify(stA))

// Non-host cannot advance.
const badNext = await rpc(B.token, 'live_next_question', { p_room_id: roomId })
check('player cannot advance', badNext.status === 400)

console.log('— reconnect keeps progress —')
const rejoin = await rpc(B.token, 'live_join_room', { p_room_code: roomRow.room_code, p_player_name: 'Basha' })
check('B rejoins the same room', rejoin.status === 200 && rejoin.data === bPlayerId, rejoin.text)
const bAfter = (await (await rest(`/live_pack_players?select=score,connected,correct_count&id=eq.${bPlayerId}`, { token: A.token })).json())[0]
check('B reconnected with score +10 kept', bAfter.connected === true && bAfter.score === 10)

// Heartbeat marks connected; sweep marks stale offline (sweep with a 1s threshold is not
// configurable — verify live_mark_connected + live_sweep_stale exist and don't error).
const beat = await rpc(B.token, 'live_mark_connected', { p_room_id: roomId })
check('heartbeat works', beat.status === 204, beat.text)
const sweep = await rpc(A.token, 'live_sweep_stale', { p_room_id: roomId })
check('host sweep works (no promotion while host connected)', sweep.status === 200 && sweep.data === null, sweep.text)

console.log('— finish + results —')
const badFinish = await rpc(C.token, 'live_finish_game', { p_room_id: roomId })
check('player cannot finish', badFinish.status === 400)
const finished = await rpc(A.token, 'live_finish_game', { p_room_id: roomId })
check('host finishes the game', finished.status === 204, finished.text)
const roomEnd = (await (await rest(`/live_pack_rooms?select=status,finished_at&id=eq.${roomId}`, { token: B.token })).json())[0]
check('room marked finished', roomEnd.status === 'finished' && Boolean(roomEnd.finished_at))

// Transfer host: mark host disconnected by joining a 2nd "host" is not possible; test the
// transfer RPC guard (host still connected → rejected).
const badTransfer = await rpc(B.token, 'live_transfer_host', { p_room_id: roomId, p_new_host_player_id: bPlayerId })
check('transfer rejected while host connected', badTransfer.status === 400 && badTransfer.text.includes('still connected'))

// ---------------------------------------------------------------------------
// No-deduction mode (deduct_on_wrong = false): wrong answers score 0, and the
// host can still flip the verdict (+wager / remove) at any time.
// ---------------------------------------------------------------------------
console.log('— no-deduction mode (deduct_on_wrong = false) —')
const created2 = await rpc(A.token, 'live_create_room', {
  p_pack_id: packId, p_question_timeout_seconds: 300, p_question_count: 3, p_min_wager: 1, p_max_wager: 20, p_deduct_on_wrong: false,
})
check('A creates room with deduction OFF', created2.status === 200, created2.text)
const room2Id = created2.data
const room2 = (await (await rest(`/live_pack_rooms?select=room_code,deduct_on_wrong&id=eq.${room2Id}`, { token: A.token })).json())[0]
check('room created with deduct_on_wrong=false', room2.deduct_on_wrong === false, JSON.stringify(room2))

// Partial settings update in the lobby — migration 019: only one field sent.
const toggleOn = await rpc(A.token, 'live_update_settings', { p_room_id: room2Id, p_deduct_on_wrong: true })
check('host toggles deduction ON in lobby (partial update)', toggleOn.status === 204, toggleOn.text)
const room2b = (await (await rest(`/live_pack_rooms?select=deduct_on_wrong&id=eq.${room2Id}`, { token: A.token })).json())[0]
check('room reflects deduction ON', room2b.deduct_on_wrong === true, JSON.stringify(room2b))
const toggleOff = await rpc(A.token, 'live_update_settings', { p_room_id: room2Id, p_deduct_on_wrong: false })
check('host toggles deduction OFF again', toggleOff.status === 204, toggleOff.text)

// Wager range guard: min > max must be rejected (RPC + CHECK constraint).
const badRange = await rpc(A.token, 'live_update_settings', { p_room_id: room2Id, p_min_wager: 30, p_max_wager: 20 })
check('invalid wager range (min>max) rejected', badRange.status === 400, badRange.text)

const bJoin2 = await rpc(B.token, 'live_join_room', { p_room_code: room2.room_code, p_player_name: 'Basha' })
check('B joins no-deduction room', bJoin2.status === 200, bJoin2.text)
const b2PlayerId = bJoin2.data
const started2 = await rpc(A.token, 'live_start_game', { p_room_id: room2Id, p_questions: [
  { quiz_id: 'custom:test', question: 'ما هي عاصمة مصر؟', answer: 'القاهرة', points: 100, hint: '' },
  { quiz_id: 'custom:test', question: 'كم عدد أيام الأسبوع؟', answer: 'سبعة', points: 300, hint: '' },
] })
check('A starts no-deduction game', started2.status === 204, started2.text)

await rpc(B.token, 'live_submit_answer', { p_room_id: room2Id, p_question_index: 0, p_answer_text: 'الإسكندرية', p_wager: 10 })
await rpc(A.token, 'live_review_answer', { p_room_id: room2Id, p_player_id: b2PlayerId, p_question_index: 0, p_status: 'wrong' })
let b2 = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${b2PlayerId}`, { token: A.token })).json())[0]
check('wrong answer in no-deduction mode scores 0', b2.score === 0 && b2.correct_count === 0, JSON.stringify(b2))

// Verdict flip still works in no-deduction mode: wrong -> correct = +wager.
await rpc(A.token, 'live_review_answer', { p_room_id: room2Id, p_player_id: b2PlayerId, p_question_index: 0, p_status: 'correct' })
b2 = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${b2PlayerId}`, { token: A.token })).json())[0]
check('flip to correct awards +10 in no-deduction mode', b2.score === 10 && b2.correct_count === 1, JSON.stringify(b2))
await rpc(A.token, 'live_review_answer', { p_room_id: room2Id, p_player_id: b2PlayerId, p_question_index: 0, p_status: 'wrong' })
b2 = (await (await rest(`/live_pack_players?select=score,correct_count&id=eq.${b2PlayerId}`, { token: A.token })).json())[0]
check('flip back to wrong removes +10 (back to 0)', b2.score === 0 && b2.correct_count === 0, JSON.stringify(b2))

const del2 = await rpc(A.token, 'live_delete_room', { p_room_id: room2Id })
check('no-deduction room cleaned up', del2.status === 204, del2.text)

// ---------------------------------------------------------------------------
// Play again: from the finished room's settings, the host opens a brand-new
// lobby with the SAME round setup and a clean slate (exactly what the
// "العب مرة أخرى" button does — createLiveRoom with the room's settings).
// ---------------------------------------------------------------------------
console.log('— play again (same settings, clean lobby) —')
const finishedSettings = (await (await rest(`/live_pack_rooms?select=question_count,question_timeout_seconds,min_wager,max_wager,deduct_on_wrong,room_code&id=eq.${roomId}`, { token: A.token })).json())[0]
const replay = await rpc(A.token, 'live_create_room', {
  p_pack_id: packId,
  p_question_count: finishedSettings.question_count,
  p_question_timeout_seconds: finishedSettings.question_timeout_seconds,
  p_min_wager: finishedSettings.min_wager,
  p_max_wager: finishedSettings.max_wager,
  p_deduct_on_wrong: finishedSettings.deduct_on_wrong,
})
check('play again creates a new room', replay.status === 200 && replay.data !== roomId, replay.text)
const replayId = replay.data
const replayRow = (await (await rest(`/live_pack_rooms?select=*&id=eq.${replayId}`, { token: A.token })).json())[0]
check('new room is a lobby with a fresh code', replayRow.status === 'lobby' && replayRow.room_code !== finishedSettings.room_code && /^[A-Z0-9]{6}$/.test(replayRow.room_code))
check('new room keeps the same round settings',
  replayRow.question_count === finishedSettings.question_count
  && replayRow.question_timeout_seconds === finishedSettings.question_timeout_seconds
  && replayRow.min_wager === finishedSettings.min_wager
  && replayRow.max_wager === finishedSettings.max_wager
  && replayRow.deduct_on_wrong === finishedSettings.deduct_on_wrong,
  JSON.stringify({ new: replayRow, old: finishedSettings }))
const replayPlayers = await (await rest(`/live_pack_players?select=id&room_id=eq.${replayId}`, { token: A.token })).json()
check('clean lobby: only the host is in it', replayPlayers.length === 1)
const replayQuestions = await (await rest(`/live_pack_questions?select=id&room_id=eq.${replayId}`, { token: A.token })).json()
check('clean lobby: no questions resolved yet', replayQuestions.length === 0)
const replayAnswers = await (await rest(`/live_pack_answers?select=id&room_id=eq.${replayId}`, { token: A.token })).json()
check('clean lobby: no answers yet', replayAnswers.length === 0)
const replayDel = await rpc(A.token, 'live_delete_room', { p_room_id: replayId })
check('play-again room cleaned up', replayDel.status === 204, replayDel.text)

// ---------------------------------------------------------------------------
// Sporcle-Party flow additions (migration 023/024/025): question images,
// explicit question_phase (active/closed), avatar storage, adjustable player
// cap, and the phase-authoritative answer cutoff.
// ---------------------------------------------------------------------------
console.log('— question images + phase + avatars + player cap —')
const imgRoom = await rpc(A.token, 'live_create_room', { p_pack_id: packId, p_max_players: 100 })
check('host creates room with cap 100', imgRoom.status === 200 && imgRoom.data, imgRoom.text)
const imgRoomId = imgRoom.data
const imgRoomRow = (await (await rest(`/live_pack_rooms?select=max_players,room_code&id=eq.${imgRoomId}`, { token: A.token })).json())[0]
check('room cap is 100', imgRoomRow.max_players === 100, JSON.stringify(imgRoomRow))

// B joins this room (needed for the phase-close checks).
const bJoin3 = await rpc(B.token, 'live_join_room', { p_room_code: imgRoomRow.room_code, p_player_name: 'Basha' })
check('B joins the phase room', bJoin3.status === 200, bJoin3.text)
const b3PlayerId = bJoin3.data

// Cap can be resized from the lobby; out-of-range rejected.
const capRes = await rpc(A.token, 'live_update_settings', { p_room_id: imgRoomId, p_max_players: 36 })
check('host resizes party to 36 from the lobby', capRes.status === 204, capRes.text)
const capRow = (await (await rest(`/live_pack_rooms?select=max_players&id=eq.${imgRoomId}`, { token: A.token })).json())[0]
check('room cap is now 36', capRow.max_players === 36, JSON.stringify(capRow))
const badCap = await rpc(A.token, 'live_update_settings', { p_room_id: imgRoomId, p_max_players: 1 })
check('cap below 2 rejected', badCap.status === 400, badCap.text)

const imgQuestions = [
  { quiz_id: 'custom:test', question: 'ما هي عاصمة مصر؟', answer: 'القاهرة', points: 100, hint: '', image_url: 'https://example.com/cairo.png' },
  { quiz_id: 'custom:test', question: 'كم عدد أيام الأسبوع؟', answer: 'سبعة', points: 300, hint: '' },
]
const imgStart = await rpc(A.token, 'live_start_game', { p_room_id: imgRoomId, p_questions: imgQuestions })
check('start with a question image', imgStart.status === 204, imgStart.text)

const phaseRow = (await (await rest(`/live_pack_rooms?select=question_phase,current_question_index&id=eq.${imgRoomId}`, { token: B.token })).json())[0]
check('question starts in the active phase', phaseRow.question_phase === 'active', JSON.stringify(phaseRow))

const imgRows = await (await rest(`/live_pack_questions?select=question_index,image_url&room_id=eq.${imgRoomId}&order=question_index.asc`, { token: B.token })).json()
check('question image_url stored (null when absent)',
  imgRows.length === 2 && imgRows[0].image_url === 'https://example.com/cairo.png' && imgRows[1].image_url === null,
  JSON.stringify(imgRows))

// Any member can close the question (ANSWERING_CLOSED); idempotent.
const close1 = await rpc(B.token, 'live_close_question', { p_room_id: imgRoomId })
check('player closes the question', close1.status === 204, close1.text)
const closedRow = (await (await rest(`/live_pack_rooms?select=question_phase&id=eq.${imgRoomId}`, { token: B.token })).json())[0]
check('phase is now closed', closedRow.question_phase === 'closed', JSON.stringify(closedRow))
const close2 = await rpc(B.token, 'live_close_question', { p_room_id: imgRoomId })
check('close is idempotent', close2.status === 204, close2.text)

// Closed phase stops new answers server-side (even before the timer runs out).
const lateSub = await rpc(B.token, 'live_submit_answer', { p_room_id: imgRoomId, p_question_index: 0, p_answer_text: 'متأخر', p_wager: 5 })
check('submission rejected once the question is closed', lateSub.status === 400 && lateSub.text.includes('closed'), lateSub.text)

// Non-member cannot close a question.
const outsiderClose = await rpc(C.token, 'live_close_question', { p_room_id: imgRoomId })
check('non-member cannot close', outsiderClose.status === 400 && outsiderClose.text.includes('in the room'), outsiderClose.text)

// Next question reopens the phase for everyone.
await rpc(A.token, 'live_next_question', { p_room_id: imgRoomId })
const reopenedRow = (await (await rest(`/live_pack_rooms?select=question_phase,current_question_index&id=eq.${imgRoomId}`, { token: B.token })).json())[0]
check('next question reopens the phase as active', reopenedRow.question_phase === 'active' && reopenedRow.current_question_index === 1, JSON.stringify(reopenedRow))

// Host review still works after a close (review happens during HOST_REVIEW).
await rpc(B.token, 'live_submit_answer', { p_room_id: imgRoomId, p_question_index: 1, p_answer_text: 'سبعة', p_wager: 10 })
await rpc(A.token, 'live_close_question', { p_room_id: imgRoomId })
const reviewAfterClose = await rpc(A.token, 'live_review_answer', { p_room_id: imgRoomId, p_player_id: b3PlayerId, p_question_index: 1, p_status: 'correct' })
check('host can still grade after the question is closed', reviewAfterClose.status === 204, reviewAfterClose.text)

// Avatar column exists and flows from user_metadata on join (null for fresh test accounts).
const playerRow = (await (await rest(`/live_pack_players?select=name,avatar_url&id=eq.${bPlayerId}`, { token: A.token })).json())[0]
check('player row exposes avatar_url', Object.prototype.hasOwnProperty.call(playerRow, 'avatar_url'), JSON.stringify(playerRow))
const hostPlayerRow = (await (await rest(`/live_pack_players?select=name,avatar_url&room_id=eq.${imgRoomId}&user_id=eq.${A.id}`, { token: A.token })).json())[0]
check('host player row stores avatar_url', Object.prototype.hasOwnProperty.call(hostPlayerRow, 'avatar_url'), JSON.stringify(hostPlayerRow))

const delImg = await rpc(A.token, 'live_delete_room', { p_room_id: imgRoomId })
check('phase room cleaned up', delImg.status === 204, delImg.text)

// Cleanup (main room).
const del = await rpc(A.token, 'live_delete_room', { p_room_id: roomId })
check('host deletes room', del.status === 204, del.text)
const after = await (await rest(`/live_pack_rooms?select=id&id=eq.${roomId}`, { token: A.token })).json()
check('room fully removed (cascade)', after.length === 0)

console.log(`\n=== LIVE PACK E2E: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)

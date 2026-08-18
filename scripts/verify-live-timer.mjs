// Verifies server-side deadline enforcement for the live question timer:
// 1) create room + join + start, 2) backdate question_started_at via SQL,
// 3) submit → must be rejected with "Time is up".
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const match = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY

const auth = (token) => ({ apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })
const rpc = async (token, fn, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...auth(token), Prefer: 'return=minimal' },
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  return { status: res.status, text }
}

const stamp = Date.now()
const signup = await (await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `timer-${stamp}@test.local`, password: 'password123' }),
})).json()
const host = signup.access_token
if (!host) throw new Error('signup failed')

const playerSignup = await (await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `timerp-${stamp}@test.local`, password: 'password123' }),
})).json()
const player = playerSignup.access_token

const packs = await (await fetch(`${SUPABASE_URL}/rest/v1/packs?status=eq.published&visibility=eq.public&select=id&limit=1`, { headers: auth(host) })).json()
const roomId = JSON.parse((await rpc(host, 'live_create_room', { p_pack_id: packs[0].id, p_question_timeout_seconds: 30 })).text)
const code = (await (await fetch(`${SUPABASE_URL}/rest/v1/live_pack_rooms?select=room_code&id=eq.${roomId}`, { headers: auth(host) })).json())[0].room_code
await rpc(player, 'live_join_room', { p_room_code: code, p_player_name: 'TimerPlayer' })
await rpc(host, 'live_start_game', { p_room_id: roomId, p_questions: [{ question: 'سؤال مؤقت', answer: 'إجابة', points: 100 }] })

// Deadline check BEFORE backdating: should succeed (with a valid wager).
const before = await rpc(player, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'إجابة', p_wager: 10 })
console.log('submit before deadline:', before.status, before.status === 204 ? 'OK (accepted)' : before.text)

// Backdate the question clock by 2 minutes → deadline long passed.
const backdateSql = `update public.live_pack_rooms set question_started_at = now() - interval '2 minutes' where id = '${roomId}';`
const sqlFile = `scripts/.tmp-backdate-${stamp}.sql`
writeFileSync(sqlFile, backdateSql)
execSync(`npx --no-install supabase db query --linked --file ${sqlFile}`, { cwd: process.cwd(), stdio: 'pipe' })
unlinkSync(sqlFile)

const after = await rpc(player, 'live_submit_answer', { p_room_id: roomId, p_question_index: 0, p_answer_text: 'متأخرة', p_wager: 10 })
console.log('submit after deadline:', after.status, after.status === 400 && after.text.includes('Time is up') ? 'OK (rejected)' : after.text)

// Cleanup.
await rpc(host, 'live_delete_room', { p_room_id: roomId })
const gone = await (await fetch(`${SUPABASE_URL}/rest/v1/live_pack_rooms?select=id&id=eq.${roomId}`, { headers: auth(host) })).json()
console.log('room cleaned:', gone.length === 0 ? 'OK' : 'MISSING')

const ok = before.status === 204 && after.status === 400 && after.text.includes('Time is up') && gone.length === 0
console.log(ok ? '=== TIMER VERIFICATION PASSED ===' : '=== TIMER VERIFICATION FAILED ===')
process.exit(ok ? 0 : 1)

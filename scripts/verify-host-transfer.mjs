// Verifies automatic host failover (migration 022):
// 1) host A + player B join a room,
// 2) the host's heartbeat is backdated via SQL (simulating a disconnect),
// 3) player B runs the presence sweep → the most active player is promoted,
// 4) the new host (B) can run the room (delete) and a second sweep is a no-op.
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
  let data = null
  try { data = JSON.parse(text) } catch { /* void */ }
  return { status: res.status, data, text }
}
const rest = async (token, path) => (await (await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: auth(token) })).json())

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ✓ ${label}`) }
  else { failed += 1; console.log(`  ✗ ${label} ${detail}`) }
}

const stamp = Date.now()
const A = await (await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `transferA-${stamp}@test.local`, password: 'password123' }),
})).json()
const B = await (await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `transferB-${stamp}@test.local`, password: 'password123' }),
})).json()
check('host A signed up', Boolean(A.access_token))
check('player B signed up', Boolean(B.access_token))

const packs = await rest(A.access_token, '/packs?status=eq.published&visibility=eq.public&select=id&limit=1')
const roomId = (await rpc(A.access_token, 'live_create_room', { p_pack_id: packs[0].id, p_question_timeout_seconds: 300 })).data
const code = (await rest(A.access_token, `/live_pack_rooms?select=room_code&id=eq.${roomId}`))[0].room_code
const bPlayerId = (await rpc(B.access_token, 'live_join_room', { p_room_code: code, p_player_name: 'سارة' })).data
check('B joined the room', Boolean(bPlayerId))
const bRow = (await rest(B.access_token, `/live_pack_players?select=user_id,name&id=eq.${bPlayerId}`))[0]

// A connected player sweep must NOT promote (host is still fresh).
const before = await rpc(B.access_token, 'live_sweep_stale', { p_room_id: roomId })
check('no promotion while host connected', before.data === null, before.text)

// Simulate the host disconnecting: backdate their heartbeat beyond 30s.
const sqlFile = `scripts/.tmp-transfer-${stamp}.sql`
writeFileSync(sqlFile, `update public.live_pack_players pl
set last_seen_at = now() - interval '2 minutes'
from public.live_pack_rooms r
where r.id = '${roomId}' and pl.room_id = r.id and r.host_auth_id = pl.user_id;`)
execSync(`npx --no-install supabase db query --linked --file ${sqlFile}`, { cwd: process.cwd(), stdio: 'pipe' })
unlinkSync(sqlFile)

// B sweeps → the sweep marks the host offline AND auto-promotes B.
const promoted = await rpc(B.access_token, 'live_sweep_stale', { p_room_id: roomId })
check('sweep promotes a player when host is offline', promoted.status === 200 && promoted.data === bPlayerId, promoted.text)
const room = (await rest(B.access_token, `/live_pack_rooms?select=host_auth_id,host_player_id,host_name&id=eq.${roomId}`))[0]
check('room host is now B', room.host_auth_id === bRow.user_id && room.host_player_id === bPlayerId && room.host_name === bRow.name, JSON.stringify(room))

// Idempotence: a second sweep with the new host connected changes nothing.
const again = await rpc(B.access_token, 'live_sweep_stale', { p_room_id: roomId })
check('second sweep is a no-op (new host connected)', again.data === null, again.text)

// The old host's row is now a regular player (offline) — no host powers left.
const oldHostReview = await rpc(A.access_token, 'live_review_answer', { p_room_id: roomId, p_player_id: bPlayerId, p_question_index: 0, p_status: 'wrong' })
check('old host lost review powers', oldHostReview.status === 400 && oldHostReview.text.includes('host'), oldHostReview.text)

// The new host has full control: delete the room.
const del = await rpc(B.access_token, 'live_delete_room', { p_room_id: roomId })
check('new host can delete the room', del.status === 204, del.text)
const gone = await rest(B.access_token, `/live_pack_rooms?select=id&id=eq.${roomId}`)
check('room fully removed', gone.length === 0)

const ok = failed === 0
console.log(`\\n=== HOST TRANSFER VERIFICATION: ${passed} passed, ${failed} failed ===`)
process.exit(ok ? 0 : 1)

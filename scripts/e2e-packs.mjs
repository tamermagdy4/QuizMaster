/* E2E test for Quiz Packs: create pack → custom quiz → questions → publish → RLS.
   Uses a throwaway signup user; cleans up all created rows afterwards. */
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const URL = get('VITE_SUPABASE_URL')
const ANON = get('VITE_SUPABASE_ANON_KEY')

const API = `${URL}/rest/v1`
const AUTH = `${URL}/auth/v1`

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

async function jfetch(path, opts = {}, token) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(URL + path, { ...opts, headers })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body }
}

const email = `packs-e2e-${Date.now()}@test.local`
const password = process.env.E2E_TEST_PASSWORD
if (!password) {
  throw new Error('E2E_TEST_PASSWORD is required')
}

console.log('\n[1] Sign up throwaway user')
let r = await jfetch('/auth/v1/signup', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
}, ANON)
// signup may return the user + session (if email confirmation disabled) or just user
const user = r.body?.user ?? r.body
const session = r.body?.session
const token = session?.access_token ?? r.body?.access_token
ok('signup responded', !!user, JSON.stringify(r.body).slice(0, 200))
if (!token) {
  console.log('  (no session returned — likely email confirmation is on; cannot continue E2E without login)')
  process.exit(0)
}
const userId = user.id
console.log(`  user: ${email} (${userId})`)

console.log('\n[2] Create pack (draft)')
r = await jfetch('/rest/v1/packs', {
  method: 'POST',
  body: JSON.stringify({
    creator_id: userId,
    title: 'باقة اختبار E2E',
    description: 'اختبار تلقائي',
    category: 'general',
    difficulty: 'medium',
    status: 'draft',
  }),
}, token)
const pack = Array.isArray(r.body) ? r.body[0] : r.body
ok('pack created', r.status === 201 && pack?.id, `HTTP ${r.status}`)

console.log('\n[3] Create custom quiz')
r = await jfetch('/rest/v1/pack_custom_quizzes', {
  method: 'POST',
  body: JSON.stringify({
    pack_id: pack.id,
    creator_id: userId,
    title: 'اختبار مخصص E2E',
    category: 'general',
    difficulty: 'easy',
  }),
}, token)
const quiz = Array.isArray(r.body) ? r.body[0] : r.body
ok('custom quiz created', r.status === 201 && quiz?.id, `HTTP ${r.status}`)

console.log('\n[4] Batch insert 12 questions (positions 0..11)')
const questions = Array.from({ length: 12 }, (_, i) => ({
  quiz_id: quiz.id,
  creator_id: userId,
  question: `سؤال تجريبي رقم ${i + 1}؟`,
  answer: `إجابة ${i + 1}`,
  points: i % 3 === 0 ? 100 : i % 3 === 1 ? 300 : 500,
  difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
  position: i,
  hint: i % 2 === 0 ? `تلميح ${i + 1}` : null,
}))
r = await jfetch('/rest/v1/pack_questions', { method: 'POST', body: JSON.stringify(questions) }, token)
const qCount = Array.isArray(r.body) ? r.body.length : 0
ok('12 questions inserted in one batch', r.status === 201 && qCount === 12, `HTTP ${r.status} count=${qCount}`)

console.log('\n[5] Link quiz into pack_quizzes via set_pack_quizzes RPC (custom:<uuid>)')
r = await jfetch('/rest/v1/rpc/set_pack_quizzes', {
  method: 'POST',
  body: JSON.stringify({ pack_id: pack.id, quiz_ids: [`custom:${quiz.id}`] }),
}, token)
ok('set_pack_quizzes ok', r.status === 200 || r.status === 204, `HTTP ${r.status} ${JSON.stringify(r.body)}`)

console.log('\n[6] Publish the pack')
r = await jfetch(`/rest/v1/packs?id=eq.${pack.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'published' }),
}, token)
ok('published', r.status === 204 || r.status === 200, `HTTP ${r.status}`)

console.log('\n[7] Anon can read published pack + quiz + questions')
r = await jfetch(`/rest/v1/packs?id=eq.${pack.id}&select=id,title,status`)
ok('anon reads pack', r.status === 200 && r.body?.[0]?.status === 'published', `HTTP ${r.status}`)
r = await jfetch(`/rest/v1/pack_custom_quizzes?pack_id=eq.${pack.id}&select=id,title`)
ok('anon reads custom quiz', r.status === 200 && r.body?.[0]?.id === quiz.id, `HTTP ${r.status}`)
r = await jfetch(`/rest/v1/pack_questions?quiz_id=eq.${quiz.id}&select=id,question,answer,points&order=position.asc`)
ok('anon reads 12 questions ordered', r.status === 200 && Array.isArray(r.body) && r.body.length === 12, `HTTP ${r.status}`)
const firstQ = r.body?.[0]
ok('first question points=100 easy', firstQ?.points === 100, JSON.stringify(firstQ))

console.log('\n[8] Play + rating RPCs')
r = await jfetch('/rest/v1/rpc/increment_pack_plays', { method: 'POST', body: JSON.stringify({ pack_id: pack.id }) }, token)
ok('increment_pack_plays ok', r.status === 200 || r.status === 204, `HTTP ${r.status}`)
r = await jfetch('/rest/v1/rpc/rate_pack', { method: 'POST', body: JSON.stringify({ pack_id: pack.id, rating: 5 }) }, token)
ok('rate_pack ok', r.status === 200 || r.status === 204, `HTTP ${r.status}`)
r = await jfetch(`/rest/v1/packs?id=eq.${pack.id}&select=plays_count,ratings_count,average_rating`, {}, token)
ok('aggregates updated', r.body?.[0]?.plays_count === 1 && r.body?.[0]?.ratings_count === 1 && Number(r.body?.[0]?.average_rating) === 5, JSON.stringify(r.body?.[0]))

console.log('\n[9] RLS: another user cannot edit/delete')
const email2 = `packs-e2e-b-${Date.now()}@test.local`
r = await jfetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email2, password }) }, ANON)
const token2 = r.body?.session?.access_token ?? r.body?.access_token
const user2 = r.body?.user ?? r.body
if (token2) {
  // PostgREST + RLS returns 200 with 0 affected rows — assert no rows changed.
  r = await jfetch(`/rest/v1/pack_custom_quizzes?id=eq.${quiz.id}`, {
    method: 'PATCH', body: JSON.stringify({ title: 'هجوم' }),
  }, token2)
  const afterPatch = await jfetch(`/rest/v1/pack_custom_quizzes?id=eq.${quiz.id}&select=title`, {}, token)
  ok('other user cannot update custom quiz', afterPatch.body?.[0]?.title !== 'هجوم', `HTTP ${r.status}`)
  r = await jfetch(`/rest/v1/pack_questions?quiz_id=eq.${quiz.id}`, { method: 'DELETE' }, token2)
  const afterDelQ = await jfetch(`/rest/v1/pack_questions?quiz_id=eq.${quiz.id}&select=id`, {}, token)
  ok('other user cannot delete questions', afterDelQ.body?.length === 12, `HTTP ${r.status} count=${afterDelQ.body?.length}`)
  r = await jfetch(`/rest/v1/packs?id=eq.${pack.id}`, { method: 'DELETE' }, token2)
  const afterDelP = await jfetch(`/rest/v1/packs?id=eq.${pack.id}&select=id,title`, {}, token)
  ok('other user cannot delete pack', afterDelP.body?.length === 1, `HTTP ${r.status}`)
} else {
  console.log('  (second user signup returned no session — skipping RLS cross-user checks)')
}

console.log('\n[10] Cleanup (owner deletes; cascade removes quizzes + questions)')
r = await jfetch(`/rest/v1/packs?creator_id=eq.${userId}&select=id,title`, {}, token)
const owned = (Array.isArray(r.body) ? r.body : []).filter((p) => p.id)
for (const p of owned) {
  const d = await jfetch(`/rest/v1/packs?id=eq.${p.id}`, { method: 'DELETE' }, token)
  if (d.status !== 204 && d.status !== 200) console.log(`  ! failed to delete pack ${p.id}: HTTP ${d.status}`)
}
ok(`deleted ${owned.length} owned pack(s)`, owned.length >= 1)
if (token2 && user2) {
  const d2 = await jfetch(`/rest/v1/packs?creator_id=eq.${user2.id}&select=id`, {}, token2)
  for (const p of d2.body ?? []) await jfetch(`/rest/v1/packs?id=eq.${p.id}`, { method: 'DELETE' }, token2)
}
// verify cascade
const qz = await jfetch(`/rest/v1/pack_custom_quizzes?creator_id=eq.${userId}&select=id`)
ok('no orphan custom quizzes remain', qz.status === 200 && (qz.body ?? []).length === 0, `HTTP ${qz.status}`)
r = await jfetch(`/rest/v1/pack_custom_quizzes?id=eq.${quiz.id}&select=id`)
ok('quiz cascade-deleted', r.status === 200 && r.body.length === 0, `HTTP ${r.status}`)
r = await jfetch(`/rest/v1/pack_questions?quiz_id=eq.${quiz.id}&select=id`)
ok('questions cascade-deleted', r.status === 200 && r.body.length === 0, `HTTP ${r.status}`)

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)

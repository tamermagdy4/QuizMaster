/* Verifies pack_stats / pack_creator_stats views with real data, then cleans up. */
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const URL = get('VITE_SUPABASE_URL')
const ANON = get('VITE_SUPABASE_ANON_KEY')

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

const email = `stats-${Date.now()}@test.local`
const r = await jfetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'TestPass!234' }) }, ANON)
const token = r.body?.access_token ?? r.body?.session?.access_token
const userId = r.body?.user?.id ?? r.body?.id
ok('signup', !!token && !!userId)

// Create pack + custom quiz + 4 questions (100, 300, 300, 500 → avg 300)
const pack = (await jfetch('/rest/v1/packs', { method: 'POST', body: JSON.stringify({ creator_id: userId, title: 'باقة إحصائيات', category: 'general', status: 'published' }) }, token)).body?.[0]
ok('pack created', !!pack?.id)
const quiz = (await jfetch('/rest/v1/pack_custom_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: pack.id, creator_id: userId, title: 'اختبار إحصائيات', category: 'general' }) }, token)).body?.[0]
ok('custom quiz created', !!quiz?.id)
// PostgREST requires ALL rows in one array to share the exact same keys.
const qs = [
  { quiz_id: quiz.id, creator_id: userId, question: 'س 1', answer: 'أ 1', points: 100, difficulty: 'easy', hint: null, image_url: null, answer_image_url: null, position: 0 },
  { quiz_id: quiz.id, creator_id: userId, question: 'س 2', answer: 'أ 2', points: 300, difficulty: 'medium', hint: null, image_url: null, answer_image_url: null, position: 1 },
  { quiz_id: quiz.id, creator_id: userId, question: 'س 3', answer: 'أ 3', points: 300, difficulty: 'medium', hint: null, image_url: null, answer_image_url: null, position: 2 },
  { quiz_id: quiz.id, creator_id: userId, question: 'س 4', answer: 'أ 4', points: 500, difficulty: 'hard', hint: null, image_url: 'https://example.com/x.jpg', answer_image_url: null, position: 3 },
]
const ins = await jfetch('/rest/v1/pack_questions', { method: 'POST', body: JSON.stringify(qs) }, token)
ok('4 questions inserted', ins.status === 201 && ins.body?.length === 4, `HTTP ${ins.status}`)

// Query the views as anon (grants were included in migration 011)
const stats = await jfetch('/rest/v1/pack_stats?select=*', {}, ANON)
const s = stats.body?.[0] ?? {}
ok('pack_stats readable by anon', stats.status === 200, `HTTP ${stats.status}`)
ok('total_custom_quizzes >= 1', Number(s.total_custom_quizzes) >= 1, JSON.stringify(s))
ok('total_pack_questions >= 4', Number(s.total_pack_questions) >= 4, JSON.stringify(s))
ok('avg_points = 300', Number(s.avg_points) === 300, `avg=${s.avg_points}`)
ok('questions_with_images >= 1', Number(s.questions_with_images) >= 1, JSON.stringify(s))
ok('total_creators >= 1', Number(s.total_creators) >= 1, JSON.stringify(s))

const creators = await jfetch('/rest/v1/pack_creator_stats?select=*&limit=5', {}, ANON)
const top = creators.body?.[0] ?? {}
ok('pack_creator_stats readable', creators.status === 200 && Array.isArray(creators.body), `HTTP ${creators.status}`)
ok('top creator: quiz_count >= 1', Number(top.custom_quiz_count) >= 1, JSON.stringify(top))
ok('top creator: question_count >= 4', Number(top.pack_question_count) >= 4, JSON.stringify(top))
ok('top creator: avg_points = 300', Number(top.avg_points) === 300, `avg=${top.avg_points}`)

// Cleanup
const del = await jfetch(`/rest/v1/packs?id=eq.${pack.id}`, { method: 'DELETE' }, token)
ok('cleanup deleted pack', del.status === 204 || del.status === 200, `HTTP ${del.status}`)
const after = await jfetch('/rest/v1/pack_stats?select=total_custom_quizzes,total_pack_questions', {}, ANON)
ok('cleanup reflected in views', Number(after.body?.[0]?.total_pack_questions ?? -1) === 0, JSON.stringify(after.body?.[0]))

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)

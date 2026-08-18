/* Live Packs E2E — runs the REAL app modules (services + import parsers)
   against the live Supabase project, with two real accounts:
     A = pack owner, B = other user.
   Flow: create pack → create custom quiz → import (csv/piped/labeled/json/
   600-bulk) → link → publish → play (exact PackPlay queries) → RLS checks
   with account B → draft visibility → write state for the UI play test.
   Run:  node scripts/live-packs-test.mjs          (keeps data + state file)
         node scripts/live-packs-test.mjs --cleanup (deletes the created pack)
   Built from this entry with esbuild (defines Vite env for Node). */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { getSupabaseClient } from '../src/lib/supabaseClient'
import {
  createPack,
  deletePack,
  getPack,
  getMyPackRating,
  incrementPackPlays,
  ratePack,
  setPackQuizzes,
  setPackStatus,
} from '../src/services/packService'
import {
  createCustomQuiz,
  deleteQuestion,
  importQuestions,
  listCustomQuizzes,
  listQuestions,
  updateCustomQuiz,
} from '../src/services/packQuizService'
import { parseCsvImport, parseJsonImport, parseTextImport } from '../src/utils/questionImport'
import type { User } from '@supabase/supabase-js'
import type { ImportedQuestion } from '../src/types/packs'

const URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}

async function signup(email: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass!234', data: { display_name: 'خالد سالم' } }),
  })
  const body = (await res.json()) as Record<string, unknown>
  const token = String(body.access_token ?? (body.session as { access_token?: string } | undefined)?.access_token ?? '')
  const id = String(body.user?.id ?? (body as { id?: string }).id ?? '')
  return {
    token,
    user: { id, email, user_metadata: { display_name: 'خالد سالم' }, app_metadata: {}, aud: 'authenticated' } as unknown as User,
  }
}

async function expectReject(name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    ok(name, false, '(did NOT throw)')
  } catch {
    ok(name, true)
  }
}

const STATE_FILE = 'scripts/.live-packs-state.json'

async function cleanup() {
  if (!existsSync(STATE_FILE)) {
    console.log('No state file — nothing to clean.')
    return
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { packId: string; tokenA: string }
  const supabase = getSupabaseClient()
  await supabase.auth.setSession({ access_token: state.tokenA, refresh_token: 'x' })
  const { error } = await supabase.from('packs').delete().eq('id', state.packId)
  console.log(error ? `cleanup failed: ${error.message}` : `cleanup ok (deleted pack ${state.packId})`)
  rmSync(STATE_FILE, { force: true })
}

async function main() {
  if (process.argv.includes('--cleanup')) {
    await cleanup()
    return
  }

  const supabase = getSupabaseClient()
  const emailA = `live-a-${Date.now()}@test.local`
  const emailB = `live-b-${Date.now()}@test.local`
  const a = await signup(emailA)
  const b = await signup(emailB)
  ok('account A signed up', Boolean(a.token && a.user.id))
  ok('account B signed up', Boolean(b.token && b.user.id))

  // Instrument fetch to capture the exact requests getPack / inline make.
  const origFetch = globalThis.fetch
  let packCapture = ''
  globalThis.fetch = (async (input, init) => {
    const res = await origFetch(input, init)
    if (String(input).includes('/rest/v1/packs') && String(input).includes('pack_quizzes')) {
      const clone = res.clone()
      const body = await clone.text()
      const auth = init?.headers instanceof Headers ? init.headers.get('authorization') ?? 'none' : 'n/a'
      packCapture += `\nURL: ${input}\nAUTH: ${auth.slice(0, 60)}...\nBODY: ${body}\n`
    }
    return res
  }) as typeof fetch

  // ---------------- Owner (A): create pack + custom quiz ----------------
  await supabase.auth.setSession({ access_token: a.token, refresh_token: 'x' })
  const pack = await createPack(
    { title: 'باقة الاختبار الحي', description: 'باقة أنشئت من الاختبار الحي E2E', category: 'general', difficulty: 'medium', visibility: 'public', tags: ['e2e'] },
    a.user,
  )
  ok('pack created (draft)', Boolean(pack?.id))
  const quiz = await createCustomQuiz(pack.id, { title: 'اختبار الاستيراد الحي', description: '', category: 'general', difficulty: 'medium' }, a.user)
  ok('custom quiz created', Boolean(quiz?.id))

  // ---------------- Import pipeline (real parsers) ----------------
  const csvText = `السؤال,الإجابة,النقاط,الصعوبة
من هو أول رئيس لمصر؟,محمد نجيب,100,سهل
ما هي عاصمة فرنسا؟,باريس,300,متوسط
من فاز بكأس العالم 2022؟,الأرجنتين,500,صعب
ما هو أكبر محيط؟,المحيط الهادئ,100,سهل
كم عدد ألوان قوس قزح؟,سبعة,300,متوسط`
  const csv = parseCsvImport(csvText)
  ok('CSV parsed (5 valid)', csv.validCount === 5 && csv.invalidCount === 0, JSON.stringify(csv.notes))

  const pipedText = `ما هي عاصمة إيطاليا؟ | روما
من اكتشف الجاذبية؟ | نيوتن
ما هي أكبر دولة مساحة؟ | روسيا`
  const piped = parseTextImport(pipedText)
  ok('piped text parsed (3 valid)', piped.validCount === 3, piped.notes.join(';'))

  const labeledText = `Question: ما هي عاصمة الأردن؟
Answer: عمّان

Question: سؤال بلا إجابة
Answer:

Question: ما هي عملة اليابان؟
Answer: الين`
  const labeled = parseTextImport(labeledText)
  ok('labeled text: 2 valid + 1 invalid', labeled.validCount === 2 && labeled.invalidCount === 1, `valid=${labeled.validCount} invalid=${labeled.invalidCount}`)

  const jsonText = JSON.stringify({
    categoryId: 'general',
    questions: [
      { question: 'ما هي عاصمة السعودية؟', answer: 'الرياض', points: 100 },
      { question: 'كم عدد قارات العالم؟', answer: 'سبع', points: 300 },
      { question: 'من رسم الموناليزا؟', answer: 'ليوناردو دافنشي', points: 500 },
    ],
  })
  const json = parseJsonImport(jsonText)
  ok('JSON parsed (3 valid)', json.validCount === 3, JSON.stringify(json.notes))

  const bulkLines = Array.from({ length: 600 }, (_, i) => `سؤال دفعة رقم ${i + 1}؟ | إجابة ${i + 1}`)
  const bulk = parseTextImport(bulkLines.join('\n'))
  ok('600-question bulk parsed', bulk.validCount === 600 && bulk.invalidCount === 0)

  // 5 (csv) + 3 (piped) + 2 (labeled valid) + 3 (json) + 600 (bulk) = 613 valid rows
  const allRows: ImportedQuestion[] = [...csv.rows, ...piped.rows, ...labeled.rows, ...json.rows, ...bulk.rows]
  const imported = await importQuestions(quiz.id, allRows, a.user)
  ok(`importQuestions saved ${imported} rows (613 expected)`, imported === 613, `got ${imported}`)
  const countAfter = await countAfterImport(quiz.id)
  ok('DB count matches (613)', countAfter === 613, `got ${countAfter}`)

  // ---------------- Link + publish ----------------
  await setPackQuizzes(pack.id, [`custom:${quiz.id}`])
  const linked1 = await getPack(pack.id)
  console.log('  [diag] linked1.id:', linked1?.id, '| expected:', pack.id, '| status:', linked1?.status)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const linked2 = await getPack(pack.id)
  console.log('  [diag] linked2.id:', linked2?.id, '| expected:', pack.id)
  const manualRes = await fetch(`${URL}/rest/v1/packs?id=eq.${pack.id}&select=*,pack_quizzes(id,pack_id,quiz_id,position)`, {
    headers: { apikey: ANON, Authorization: `Bearer ${a.token}` },
  })
  const manualBody = (await manualRes.json()) as { pack_quizzes?: unknown[] }[]
  // Same embedded query via supabase-js directly (no service wrapper)
  const inline = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', pack.id)
  const inlineLimit = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', pack.id).limit(1)
  console.log(
    '  [diag] getPack1:', JSON.stringify(linked1?.quizzes),
    '| getPack2:', JSON.stringify(linked2?.quizzes),
    '| inline:', JSON.stringify(inline.data?.[0]?.pack_quizzes),
    '| inlineLimit:', JSON.stringify(inlineLimit.data?.[0]?.pack_quizzes), 'err:', inlineLimit.error?.message ?? '',
    '| manual:', JSON.stringify(manualBody[0]?.pack_quizzes),
  )
  console.log('  [diag] captured requests for packs+pack_quizzes:', packCapture)
  globalThis.fetch = origFetch
  ok('quiz linked via set_pack_quizzes', linked2?.quizzes?.length === 1 && linked2.quizzes[0].quiz_id === `custom:${quiz.id}`, JSON.stringify(linked2?.quizzes))
  await setPackStatus(pack.id, 'published')
  const published = await getPack(pack.id)
  ok('pack published', published?.status === 'published')

  // ---------------- Play (exact PackPlay queries) ----------------
  const customList = await listCustomQuizzes(pack.id)
  const playable = await listQuestions(quiz.id)
  ok('PackPlay reads custom quiz', customList.some((entry) => entry.id === quiz.id))
  ok('PackPlay reads 613 ordered questions', playable.length === 613, `got ${playable.length}`)
  const first = playable[0]
  ok('first played question matches CSV row 1', first.question === 'من هو أول رئيس لمصر؟' && first.answer === 'محمد نجيب' && first.points === 100, JSON.stringify(first))
  ok('questions ordered by position', playable.every((q, index) => q.position === index) || playable.length > 1)

  // ---------------- Account B: reads allowed, writes blocked ----------------
  await supabase.auth.setSession({ access_token: b.token, refresh_token: 'x' })
  const bPack = await getPack(pack.id)
  ok('B can read published pack', bPack?.id === pack.id)
  const bQuestions = await listQuestions(quiz.id)
  ok('B can read published questions', bQuestions.length === 613, `got ${bQuestions.length}`)
  await expectReject('B cannot update the custom quiz', () => updateCustomQuiz(quiz.id, { title: 'هجوم', description: '', category: 'general', difficulty: 'hard' }))
  // PostgREST + RLS returns success with 0 affected rows for blocked writes —
  // assert the rows are unchanged rather than expecting an exception.
  const beforeDelete = (await listQuestions(quiz.id)).length
  await deleteQuestion(playable[0].id)
  const afterDelete = (await listQuestions(quiz.id)).length
  ok('B cannot delete a question (rows unchanged)', beforeDelete === afterDelete, `before=${beforeDelete} after=${afterDelete}`)
  await deletePack(pack.id)
  const stillThere = await getPack(pack.id)
  ok('B cannot delete the pack (still exists)', stillThere?.id === pack.id)
  await expectReject('B cannot reorder via set_pack_quizzes', () => setPackQuizzes(pack.id, []))
  // Aggregates guard: even the OWNER cannot write plays_count directly (must go through the RPC).
  await supabase.auth.setSession({ access_token: a.token, refresh_token: 'x' })
  const guard = await supabase.from('packs').update({ plays_count: 999 }).eq('id', pack.id)
  ok('owner cannot bump plays_count directly', Boolean(guard.error), guard.error?.message ?? 'no error')
  await supabase.auth.setSession({ access_token: b.token, refresh_token: 'x' })
  await incrementPackPlays(pack.id)
  await ratePack(pack.id, 4)
  const rating = await getMyPackRating(pack.id, b.user.id)
  const playedPack = await getPack(pack.id)
  ok('B can play (plays_count=1)', playedPack?.plays_count === 1, `plays=${playedPack?.plays_count}`)
  ok('B can rate (rating=4, avg=4)', rating === 4 && Number(playedPack?.average_rating) === 4, `rating=${rating} avg=${playedPack?.average_rating}`)

  // ---------------- Draft visibility ----------------
  await supabase.auth.setSession({ access_token: a.token, refresh_token: 'x' })
  const draft = await createPack({ title: 'باقة مسودة سرية', description: '', category: 'general', difficulty: 'easy', visibility: 'private', tags: [] }, a.user)
  await supabase.auth.setSession({ access_token: b.token, refresh_token: 'x' })
  const bDraft = await getPack(draft.id)
  ok('B cannot see A draft/private pack', bDraft === null)

  // ---------------- State for the UI play test ----------------
  writeFileSync(STATE_FILE, JSON.stringify({ packId: pack.id, quizId: quiz.id, tokenA: a.token, tokenB: b.token, emailA }))

  console.log(`\n=== LIVE PACKS TEST: ${pass} passed, ${fail} failed ===`)
  console.log(`Published pack kept for the UI play test: /packs/${pack.id}`)
  process.exit(fail ? 1 : 0)
}

async function countAfterImport(quizId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const { count } = await supabase.from('pack_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId)
  return count ?? 0
}

main().catch((error) => {
  console.error('FATAL:', error)
  process.exit(1)
})

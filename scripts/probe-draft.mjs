/* Isolates why the embedded pack_quizzes read returns [] for DRAFT packs via
   supabase-js but works for published ones (and works via raw REST for both). */
import { readFileSync, writeFileSync } from 'node:fs'
import { getSupabaseClient } from '../src/lib/supabaseClient'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const URL = (get('VITE_SUPABASE_URL') || '').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')

const state = JSON.parse(readFileSync('scripts/.live-packs-state.json', 'utf8'))
const supabase = getSupabaseClient()
await supabase.auth.setSession({ access_token: state.tokenA, refresh_token: 'x' })

// Who is A? (from the current pack)
const me = (await supabase.from('packs').select('creator_id').eq('id', state.packId).single()).data?.creator_id

const { data: quiz } = await supabase.from('pack_custom_quizzes').select('id').eq('id', state.quizId).single()

// Fresh DRAFT pack
const { data: draft } = await supabase
  .from('packs')
  .insert({ creator_id: me, title: 'باقة مسبار المسودة المضمّن', category: 'general', status: 'draft' })
  .select()
  .single()
console.log('draft pack:', draft?.id)

// Link via the RPC
const rpc = await supabase.rpc('set_pack_quizzes', { pack_id: draft.id, quiz_ids: [`custom:${state.quizId}`] })
console.log('rpc error:', rpc.error?.message ?? 'none')

const readEmbedded = async (label) => {
  const noLimit = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', draft.id)
  const withLimit = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', draft.id).limit(1)
  const withRange = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', draft.id).range(0, 0)
  console.log(`  ${label} noLimit  :`, JSON.stringify(noLimit.data?.[0]?.pack_quizzes))
  console.log(`  ${label} limit(1) :`, JSON.stringify(withLimit.data?.[0]?.pack_quizzes), 'err:', withLimit.error?.message ?? '')
  console.log(`  ${label} range    :`, JSON.stringify(withRange.data?.[0]?.pack_quizzes))
  const direct = await supabase.from('pack_quizzes').select('id').eq('pack_id', draft.id)
  console.log(`  ${label} direct   :`, JSON.stringify(direct.data))
}

console.log('\n--- as DRAFT ---')
await readEmbedded('draft')

// Publish, read again
await supabase.from('packs').update({ status: 'published' }).eq('id', draft.id)
console.log('\n--- as PUBLISHED ---')
await readEmbedded('published')

// Raw REST embedded on the draft (before deleting, unpublish first to test draft raw)
await supabase.from('packs').update({ status: 'draft' }).eq('id', draft.id)
const rawRes = await fetch(`${URL}/rest/v1/packs?id=eq.${draft.id}&select=*,pack_quizzes(id,pack_id,quiz_id,position)`, {
  headers: { apikey: ANON, Authorization: `Bearer ${state.tokenA}` },
})
const raw = await rawRes.json()
console.log('\n--- raw REST as DRAFT ---')
console.log('  raw embedded:', JSON.stringify(raw[0]?.pack_quizzes))

// cleanup
await supabase.from('packs').delete().eq('id', draft.id)
console.log('\nprobe draft cleaned up')

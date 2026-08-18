/* Decisive RLS/RPC probe — isolates:
   (a) set_pack_quizzes on a DRAFT pack (owner A)
   (b) set_pack_quizzes on a PUBLISHED pack as non-owner B (security check)
*/
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const URL = (get('VITE_SUPABASE_URL') || '').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const state = JSON.parse(readFileSync('scripts/.live-packs-state.json', 'utf8'))

async function call(path, opts = {}, token) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(URL + path, { ...opts, headers })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body }
}

const A = state.tokenA
const B = state.tokenB

// Fresh draft pack as A
const draft = (await call('/rest/v1/packs', {
  method: 'POST',
  body: JSON.stringify({ creator_id: (await call('/rest/v1/packs?id=eq.' + state.packId + '&select=creator_id', {}, A)).body[0].creator_id, title: 'باقة مسبار المسودة', category: 'general', status: 'draft' }),
}, A)).body?.[0]
console.log('draft pack:', draft?.id)

console.log('\n[a] set_pack_quizzes on DRAFT as owner A')
let r = await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: draft.id, quiz_ids: ['custom:' + state.quizId] }) }, A)
console.log('  rpc:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${draft.id}&select=quiz_id,position`, {}, A)
console.log('  pack_quizzes now:', r.status, JSON.stringify(r.body))

console.log('\n[b] publish the draft, then set_pack_quizzes as owner A')
await call(`/rest/v1/packs?id=eq.${draft.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'published' }) }, A)
r = await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: draft.id, quiz_ids: ['custom:' + state.quizId] }) }, A)
console.log('  rpc:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${draft.id}&select=quiz_id,position`, {}, A)
console.log('  pack_quizzes now:', r.status, JSON.stringify(r.body))

console.log('\n[c] set_pack_quizzes on the PUBLISHED pack as NON-OWNER B (should be rejected)')
r = await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: draft.id, quiz_ids: ['hacked-fake-id'] }) }, B)
console.log('  rpc:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${draft.id}&select=quiz_id,position`, {}, A)
console.log('  pack_quizzes after B (hacked present?):', r.status, JSON.stringify(r.body))

// restore + cleanup the probe draft
await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: draft.id, quiz_ids: [] }) }, A)
await call(`/rest/v1/packs?id=eq.${draft.id}`, { method: 'DELETE' }, A)
console.log('\nprobe draft cleaned up')

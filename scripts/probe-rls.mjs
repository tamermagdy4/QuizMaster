/* Raw REST probe using the state file tokens — diagnoses the anomalies found
   in the live test (B delete, RPC as B, pack_quizzes link visibility). */
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

console.log('pack:', state.packId)

console.log('\n[1] pack_quizzes of the pack (A token)')
let r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${state.packId}&select=quiz_id,position`, {}, state.tokenA)
console.log('  ', r.status, JSON.stringify(r.body))

console.log('\n[2] set_pack_quizzes RPC as B (should be rejected)')
r = await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: state.packId, quiz_ids: [] }) }, state.tokenB)
console.log('  ', r.status, JSON.stringify(r.body))

console.log('\n[3] set_pack_quizzes RPC as A (re-link)')
r = await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: state.packId, quiz_ids: [`custom:${state.quizId}`] }) }, state.tokenA)
console.log('  ', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${state.packId}&select=quiz_id,position`, {}, state.tokenA)
console.log('  after re-link:', r.status, JSON.stringify(r.body))

console.log('\n[4] DELETE one question as B (should be blocked)')
const q = await call(`/rest/v1/pack_questions?quiz_id=eq.${state.quizId}&select=id&limit=1`, {}, state.tokenB)
const qid = q.body?.[0]?.id
r = await call(`/rest/v1/pack_questions?id=eq.${qid}`, { method: 'DELETE' }, state.tokenB)
console.log('  delete:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_questions?quiz_id=eq.${state.quizId}&select=id&limit=3`, {}, state.tokenB)
console.log('  rows remain:', r.status, JSON.stringify(r.body))

console.log('\n[5] DELETE pack as B (should be blocked)')
r = await call(`/rest/v1/packs?id=eq.${state.packId}`, { method: 'DELETE' }, state.tokenB)
console.log('  delete:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/packs?id=eq.${state.packId}&select=id,title,status`, {}, state.tokenA)
console.log('  pack still exists:', r.status, JSON.stringify(r.body))

/* Isolates why getPack's embedded pack_quizzes returns [] — tests the same
   embedded select via raw REST on (a) the current published pack, (b) a fresh
   draft pack with a linked quiz. */
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
const me = (await call('/rest/v1/packs?id=eq.' + state.packId + '&select=creator_id', {}, A)).body?.[0]

console.log('\n[a] embedded pack_quizzes on the PUBLISHED pack (as A)')
let r = await call(`/rest/v1/packs?id=eq.${state.packId}&select=id,title,status,pack_quizzes(id,pack_id,quiz_id,position)`, {}, A)
console.log('  ', r.status, JSON.stringify(r.body))

console.log('\n[b] fresh DRAFT pack + linked quiz, embedded read (as A)')
const draft = (await call('/rest/v1/packs', { method: 'POST', body: JSON.stringify({ creator_id: me.creator_id, title: 'باقة مسبار مضمّن', category: 'general', status: 'draft' }) }, A)).body?.[0]
await call('/rest/v1/rpc/set_pack_quizzes', { method: 'POST', body: JSON.stringify({ pack_id: draft.id, quiz_ids: ['custom:' + state.quizId] }) }, A)
r = await call(`/rest/v1/packs?id=eq.${draft.id}&select=id,status,pack_quizzes(id,pack_id,quiz_id,position)`, {}, A)
console.log('  embedded:', r.status, JSON.stringify(r.body))
r = await call(`/rest/v1/pack_quizzes?pack_id=eq.${draft.id}&select=id,pack_id,quiz_id,position`, {}, A)
console.log('  direct :', r.status, JSON.stringify(r.body))

// cleanup the probe draft
await call(`/rest/v1/packs?id=eq.${draft.id}`, { method: 'DELETE' }, A)
console.log('probe draft cleaned up')

/* Reproduces the getPack embedded pack_quizzes read via the real app service,
   using the live-test state file (published pack + linked quiz). */
import { readFileSync } from 'node:fs'
import { getSupabaseClient } from '../src/lib/supabaseClient'
import { getPack } from '../src/services/packService'

const state = JSON.parse(readFileSync('scripts/.live-packs-state.json', 'utf8'))
const supabase = getSupabaseClient()
await supabase.auth.setSession({ access_token: state.tokenA, refresh_token: 'x' })

// Log the exact request the client sends (URL + headers) for the getPack query.
const originalFetch = globalThis.fetch
let captured = ''
globalThis.fetch = (async (input, init) => {
  if (String(input).includes('rest/v1/packs')) {
    const headers = init?.headers
    let headerText = ''
    if (headers instanceof Headers) {
      headerText = Array.from(headers.entries()).map(([k, v]) => `${k}: ${v}`).join(' | ')
    } else if (headers && typeof headers === 'object') {
      headerText = JSON.stringify(headers)
    }
    const res = await originalFetch(input, init)
    const clone = res.clone()
    const bodyText = await clone.text()
    captured = `${input}\nheaders: ${headerText}\nresponse: ${bodyText.slice(0, 800)}`
    return res
  }
  return originalFetch(input, init)
}) as typeof fetch

const pack = await getPack(state.packId)
console.log('--- captured request ---')
console.log(captured)
console.log('--- getPack (maybeSingle) quizzes:', JSON.stringify(pack?.quizzes))

// Isolate: same embedded select WITHOUT maybeSingle (array mode)
const q1 = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', state.packId)
console.log('--- array mode, no maybeSingle:', JSON.stringify(q1.data?.[0]?.pack_quizzes))
const q2 = await supabase.from('packs').select('*, pack_quizzes(*)').eq('id', state.packId)
console.log('--- array mode, pack_quizzes(*):', JSON.stringify(q2.data?.[0]?.pack_quizzes))
const q3 = await supabase.from('packs').select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)').eq('id', state.packId).limit(1)
console.log('--- limit(1), no maybeSingle:', JSON.stringify(q3.data?.[0]?.pack_quizzes))

const { data: direct } = await supabase
  .from('pack_quizzes')
  .select('id, pack_id, quiz_id, position, created_at')
  .eq('pack_id', state.packId)
console.log('direct rows     :', JSON.stringify(direct))

// Raw REST equivalent of the embedded select, via fetch with A's token
const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/packs?id=eq.${state.packId}&select=*,pack_quizzes(id,pack_id,quiz_id,position,created_at)`, {
  headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${state.tokenA}` },
})
const raw = await res.json()
console.log('raw REST embed  :', JSON.stringify(raw[0]?.pack_quizzes))

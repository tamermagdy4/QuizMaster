/** Creates a fresh player auth session for browser testing of the player view. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
if (!url || !anon) throw new Error('Supabase env missing')

const stamp = Date.now().toString(36)
const admin = createClient(url, anon)
const password = process.env.E2E_TEST_PASSWORD
if (!password) {
  throw new Error('E2E_TEST_PASSWORD is required')
}
const { data, error } = await admin.auth.signUp({
  email: `dbg2-${stamp}@test.local`,
  password,
  options: { data: { name: 'عمر اللاعب' } },
})
if (error || !data.session) throw new Error('signUp: ' + error?.message)
writeFileSync('public/.ui-debug2.json', JSON.stringify({ session: data.session }), 'utf8')
console.log('player session ready')

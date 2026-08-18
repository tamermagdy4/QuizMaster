import { rolldown } from 'rolldown'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = (key) =>
  env
    .split('\n')
    .find((line) => line.startsWith(key))
    ?.split('=')
    .slice(1)
    .join('=')
    .trim()
    .replace(/^"|"$/g, '')

const url = get('VITE_SUPABASE_URL')
const key = get('VITE_SUPABASE_ANON_KEY')
if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env.local')

// This rolldown build (1.2.x) does not honour the `define` input option, so we
// inject the Vite env via a tiny transform plugin instead.
const envPlugin = {
  name: 'inject-vite-env',
  transform(code) {
    if (!code.includes('import.meta.env')) return null
    return code
      .replaceAll('import.meta.env.VITE_SUPABASE_URL', JSON.stringify(url))
      .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', JSON.stringify(key))
  },
}

const entry = process.argv[2] ?? 'scripts/live-packs-entry.ts'

const bundle = await rolldown({
  input: entry,
  platform: 'node',
  plugins: [envPlugin],
  resolve: {
    // Vite-style extension resolution for relative imports without extensions
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
})

await bundle.write({
  dir: 'scripts/.out',
  format: 'esm',
  entryFileNames: 'live-packs-test.mjs',
})

console.log(`bundled scripts/.out/live-packs-test.mjs from ${entry}`)

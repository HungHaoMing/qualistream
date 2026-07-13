import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDatabase, transaction } from './db.js'
import { loadConfig } from './config.js'

export async function migrate(connectionString = loadConfig().DATABASE_URL) {
  const db = createDatabase(connectionString)
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const applied = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map(row => row.name))
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue
    const sql = await readFile(join(dir, name), 'utf8')
    await transaction(db, async client => { await client.query(sql); await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]) })
  }
  await db.end()
}
if (process.argv[1] === fileURLToPath(import.meta.url)) migrate().catch(error => { console.error(error); process.exit(1) })

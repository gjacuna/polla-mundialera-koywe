// Seed the matches table from scripts/data/fixture.json
//
// Usage:
//   node scripts/seed-matches.mjs          # seeds only if the table is empty
//   node scripts/seed-matches.mjs --force  # wipes matches AND predictions, then re-seeds
//
// Matches are inserted in official matchNumber order (1-104) on a fresh table,
// so serial ids align with FIFA match numbers (e.g. "Ganador Partido 73" -> id 73).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Minimal .env.local loader (no dotenv dependency)
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (checked env and .env.local)')
  process.exit(1)
}

const fixture = JSON.parse(readFileSync(path.join(root, 'scripts/data/fixture.json'), 'utf8'))
fixture.sort((a, b) => a.matchNumber - b.matchNumber)

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const force = process.argv.includes('--force')

try {
  const { rows: [{ count }] } = await pool.query('SELECT count(*)::int AS count FROM matches')

  if (count > 0 && !force) {
    console.log(`matches table already has ${count} rows — nothing to do.`)
    console.log('(re-run with --force to wipe and re-seed; that also deletes all predictions)')
    process.exit(0)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (force) {
      await client.query('TRUNCATE predictions, matches RESTART IDENTITY')
      console.log(`Wiped ${count} existing matches (and all predictions).`)
    }
    for (const m of fixture) {
      await client.query(
        `INSERT INTO matches ("homeTeam", "awayTeam", "homeFlag", "awayFlag", "matchDate", "stage", "group", "status", "externalId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)`,
        [m.homeTeam, m.awayTeam, m.homeFlag, m.awayFlag, m.matchDate, m.stage, m.group, m.externalId ?? null]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  console.log(`Seeded ${fixture.length} matches.`)
} finally {
  await pool.end()
}

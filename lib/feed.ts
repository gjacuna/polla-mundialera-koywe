// Results feed: TheSportsDB (free tier — no paid plan required).
//
// Env (all optional, sensible defaults):
//   THESPORTSDB_KEY     - API key. Default '3' (free public key).
//   THESPORTSDB_LEAGUE  - league id. Default '4429' (FIFA World Cup).
//   THESPORTSDB_SEASON  - season. Default '2026'.
//   THESPORTSDB_BASE    - base URL override (for tests/mocks).
//
// The reliable free endpoint is eventsday (a full day's fixtures), so the cron
// fetches the specific days it has pending matches for. Team names come back in
// English ("South Korea", "Bosnia-Herzegovina"); lib/team-names.ts maps our
// Spanish names to them.
//
// Note: the free tier exposes no penalty-shootout field, so knockout ties come
// through as a level score with null penalties — an admin sets the shootout
// result so the bracket can advance. Regular results need no manual step.

const KEY = process.env.THESPORTSDB_KEY || '3'
const LEAGUE = process.env.THESPORTSDB_LEAGUE || '4429'
const SEASON = process.env.THESPORTSDB_SEASON || '2026'
const BASE = process.env.THESPORTSDB_BASE || 'https://www.thesportsdb.com/api/v1/json'

// strStatus values that mean the match is over.
const FINISHED = new Set(['FT', 'AET', 'PEN', 'Match Finished', 'AOT'])

export type Fixture = {
  fixtureId: number // idEvent
  date: string // kickoff ISO (used to match by day)
  homeName: string
  awayName: string
  status: string
  finished: boolean
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
}

type RawEvent = {
  idEvent: string
  idLeague: string
  strTimestamp: string | null
  dateEvent: string | null
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string | null
}

const toInt = (v: string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function fetchDay(day: string): Promise<RawEvent[]> {
  const url = `${BASE}/${KEY}/eventsday.php?d=${encodeURIComponent(day)}&l=${encodeURIComponent(LEAGUE)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`TheSportsDB ${res.status} for ${day}: ${await res.text()}`)
  }
  const body = (await res.json()) as { events: RawEvent[] | null }
  // The `l` filter is unreliable on the free tier, so also filter by idLeague.
  return (body.events || []).filter((e) => e.idLeague === LEAGUE)
}

function normalize(e: RawEvent): Fixture {
  const status = e.strStatus || ''
  return {
    fixtureId: Number(e.idEvent),
    date: e.strTimestamp || `${e.dateEvent}T00:00:00+00:00`,
    homeName: e.strHomeTeam,
    awayName: e.strAwayTeam,
    status,
    finished: FINISHED.has(status),
    homeScore: toInt(e.intHomeScore),
    awayScore: toInt(e.intAwayScore),
    // No penalty field on the free tier.
    homePenalties: null,
    awayPenalties: null,
  }
}

// Fetch and normalize fixtures for the given UTC days (deduped). Days are
// fetched sequentially to stay gentle on the free-tier rate limit. A failed day
// (e.g. a 429 rate-limit) is skipped rather than failing the whole run — those
// matches just sync on a later run, or get entered by hand. Throws only if
// every day failed (so a totally broken feed still surfaces).
export async function fetchFixturesForDays(
  days: string[]
): Promise<{ fixtures: Fixture[]; failedDays: number }> {
  const unique = [...new Set(days)]
  const out: Fixture[] = []
  let failedDays = 0
  let lastError: unknown = null
  for (const day of unique) {
    try {
      const events = await fetchDay(day)
      for (const e of events) out.push(normalize(e))
    } catch (e) {
      failedDays++
      lastError = e
    }
  }
  if (failedDays === unique.length && unique.length > 0) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
  return { fixtures: out, failedDays }
}

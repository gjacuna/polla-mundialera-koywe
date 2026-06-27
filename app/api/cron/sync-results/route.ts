// Cron endpoint: keep our matches in sync with the results feed (TheSportsDB).
// Each run it:
//   1. finds matches that should have a result by now (kicked off, still
//      scheduled, real teams — not placeholders);
//   2. fetches the feed for exactly those days and matches by team name + day;
//   3. applies finished results, re-scoring predictions and resolving the
//      knockout bracket — which fills the next round's teams and opens their
//      predictions. The next run then picks up that round, converging up to
//      the final. Fully hands-off; no manual mapping step.
//
// Trigger from Upstash QStash (scheduled POST) or Vercel Cron. Both can send
// `Authorization: Bearer <CRON_SECRET>`, which is what we check.
//
//   GET  /api/cron/sync-results?dry=1   -> preview without writing
//   POST /api/cron/sync-results         -> apply

import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { fetchFixturesForDays, type Fixture } from '@/lib/feed'
import { normalizeTeam } from '@/lib/team-names'
import { hasPlaceholderTeams } from '@/lib/match-utils'
import { applyMatchResult } from '@/lib/match-results'
import { resolveBracket } from '@/lib/bracket'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Our seed's kickoff dates can drift a day from the real schedule, so we match
// on the (unique) team pairing across all fetched fixtures and use date only as
// a tiebreaker for the rare case a pairing repeats (e.g. a knockout rematch).
function findFixture(
  match: { homeTeam: string; awayTeam: string; matchDate: Date },
  fixtures: Fixture[]
): Fixture | undefined {
  const h = normalizeTeam(match.homeTeam)
  const a = normalizeTeam(match.awayTeam)
  const candidates = fixtures.filter((f) => {
    const fh = normalizeTeam(f.homeName)
    const fa = normalizeTeam(f.awayName)
    return (fh === h && fa === a) || (fh === a && fa === h)
  })
  if (candidates.length <= 1) return candidates[0]
  const t = match.matchDate.getTime()
  return candidates.sort(
    (x, y) =>
      Math.abs(new Date(x.date).getTime() - t) - Math.abs(new Date(y.date).getTime() - t)
  )[0]
}

// Days to fetch: each pending match's day plus the adjacent days, to absorb
// seed-vs-feed date drift.
function daysAround(dates: Date[]): string[] {
  const out = new Set<string>()
  for (const d of dates) {
    const base = new Date(d)
    for (const delta of [-1, 0, 1]) {
      const x = new Date(base)
      x.setUTCDate(x.getUTCDate() + delta)
      out.add(x.toISOString().slice(0, 10))
    }
  }
  return [...out]
}

async function sync(dry: boolean) {
  const now = Date.now()
  const all = await db.select().from(matches)

  // Matches that should have a result by now: kicked off, still scheduled, and
  // with real teams (placeholders resolve via the bracket as earlier rounds
  // finish, then get picked up on a later run).
  const pending = all.filter(
    (m) =>
      m.status === 'scheduled' &&
      !hasPlaceholderTeams(m) &&
      new Date(m.matchDate).getTime() <= now
  )

  const applied: Array<{ id: number; score: string }> = []
  const errors: Array<{ id: number; error: string }> = []
  const unmatched: Array<{ id: number; teams: string }> = []
  let failedDays = 0
  let fixtures: Awaited<ReturnType<typeof fetchFixturesForDays>>['fixtures'] = []

  if (pending.length > 0) {
    const days = daysAround(pending.map((m) => new Date(m.matchDate)))
    const fetched = await fetchFixturesForDays(days)
    fixtures = fetched.fixtures
    failedDays = fetched.failedDays
  }

  for (const m of pending) {
    const fx = findFixture(m, fixtures)
    if (!fx) {
      unmatched.push({ id: m.id, teams: `${m.homeTeam} vs ${m.awayTeam}` })
      continue
    }
    if (!fx.finished || fx.homeScore == null || fx.awayScore == null) continue // kicked off, not final yet
    const score = `${fx.homeScore}-${fx.awayScore}${
      fx.homePenalties != null ? ` (pen ${fx.homePenalties}-${fx.awayPenalties})` : ''
    }`
    if (dry) {
      applied.push({ id: m.id, score })
      continue
    }
    try {
      await applyMatchResult(m.id, fx.homeScore, fx.awayScore, fx.homePenalties, fx.awayPenalties)
      if (m.externalId == null) {
        await db.update(matches).set({ externalId: fx.fixtureId }).where(eq(matches.id, m.id))
      }
      applied.push({ id: m.id, score })
    } catch (e) {
      errors.push({ id: m.id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Always resolve the bracket (idempotent) — not just after applying a result.
  // This lets a plain call to this endpoint fill knockout teams from results
  // that are already in the DB (e.g. entered by hand before this code existed).
  const resolved = dry ? [] : await resolveBracket()

  return {
    dry,
    failedDays, // days skipped due to feed errors / rate limiting
    feed: fixtures.length,
    applied,
    errors,
    resolved, // ids of knockout matches whose teams were just filled in
    unmatched, // real-team matches the feed didn't name-match — extend ALIASES in lib/team-names.ts
  }
}

async function handle(req: Request, dry: boolean) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await sync(dry))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return handle(req, false)
}

export async function GET(req: Request) {
  return handle(req, new URL(req.url).searchParams.get('dry') === '1')
}

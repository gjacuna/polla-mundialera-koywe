// Cron endpoint: keep our matches in sync with API-Football. Each run it:
//   1. auto-maps externalId for any match with real teams that isn't mapped yet
//      (by team name + kickoff day), so no manual mapping step is ever needed;
//   2. applies finished results for mapped matches, re-scoring predictions and
//      resolving the knockout bracket (which opens predictions for next round).
//
// As group results resolve round-of-32 teams, the next run maps + applies that
// round, and so on up to the final — fully hands-off.
//
// Trigger from Upstash QStash (scheduled HTTP POST) or Vercel Cron. Both can
// send `Authorization: Bearer <CRON_SECRET>`, which is what we check.
//
//   GET  /api/cron/sync-results?dry=1   -> preview without writing
//   POST /api/cron/sync-results         -> apply

import { db } from '@/lib/db'
import { matches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { fetchFixtures, type Fixture } from '@/lib/api-football'
import { normalizeTeam, sameDay } from '@/lib/team-names'
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

function findFixture(
  match: { homeTeam: string; awayTeam: string; matchDate: Date },
  fixtures: Fixture[]
): Fixture | undefined {
  const h = normalizeTeam(match.homeTeam)
  const a = normalizeTeam(match.awayTeam)
  return fixtures.find((f) => {
    if (!sameDay(f.date, match.matchDate)) return false
    const fh = normalizeTeam(f.homeName)
    const fa = normalizeTeam(f.awayName)
    return (fh === h && fa === a) || (fh === a && fa === h)
  })
}

async function sync(dry: boolean) {
  const fixtures = await fetchFixtures()
  const byId = new Map(fixtures.map((f) => [f.fixtureId, f]))

  const all = await db.select().from(matches)

  // 1) Auto-map externalId for matches whose teams are known (not placeholders).
  const mapped: Array<{ id: number; externalId: number }> = []
  const unmatched: Array<{ id: number; teams: string }> = []
  for (const m of all) {
    if (m.externalId != null) continue
    if (hasPlaceholderTeams(m)) continue
    const fx = findFixture(m, fixtures)
    if (!fx) {
      unmatched.push({ id: m.id, teams: `${m.homeTeam} vs ${m.awayTeam}` })
      continue
    }
    mapped.push({ id: m.id, externalId: fx.fixtureId })
    m.externalId = fx.fixtureId // reflect locally so step 2 can use it this run
    if (!dry) {
      await db
        .update(matches)
        .set({ externalId: fx.fixtureId })
        .where(eq(matches.id, m.id))
    }
  }

  // 2) Apply finished results for mapped, still-scheduled matches.
  const applied: Array<{ id: number; score: string }> = []
  const errors: Array<{ id: number; error: string }> = []
  for (const m of all) {
    if (m.externalId == null || m.status !== 'scheduled') continue
    const fx = byId.get(m.externalId)
    if (!fx || !fx.finished || fx.homeScore == null || fx.awayScore == null) continue
    const score = `${fx.homeScore}-${fx.awayScore}${
      fx.homePenalties != null ? ` (pen ${fx.homePenalties}-${fx.awayPenalties})` : ''
    }`
    if (dry) {
      applied.push({ id: m.id, score })
      continue
    }
    try {
      await applyMatchResult(m.id, fx.homeScore, fx.awayScore, fx.homePenalties, fx.awayPenalties)
      applied.push({ id: m.id, score })
    } catch (e) {
      errors.push({ id: m.id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!dry && applied.length) await resolveBracket()

  return {
    dry,
    feed: fixtures.length,
    mapped,
    applied,
    errors,
    unmatched, // matches with real teams we couldn't name-match — extend ALIASES in lib/team-names.ts
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

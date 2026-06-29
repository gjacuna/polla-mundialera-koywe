// Resolve knockout fixtures from real results and write the qualified teams
// back into the matches table. Filling a placeholder ("2° Grupo A",
// "Ganador Partido 73") with a real team name is what flips
// `hasPlaceholderTeams` to false — which is exactly what opens predictions
// for that elimination match.
//
// Two sources of truth:
//   1. Group standings  -> the round-of-32 slots ("1°/2°/3° Grupo X")
//   2. Finished knockout results -> later rounds ("Ganador/Perdedor Partido N")
//
// Match ids align with FIFA match numbers (see scripts/seed-matches.mjs), so
// "Ganador Partido 73" resolves against the match with id 73.

import { db } from '@/lib/db'
import { matches as matchesTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isPlaceholderTeam } from '@/lib/match-utils'
import { simulateGroups, simulateRound32 } from '@/lib/simulation'

type MatchRow = typeof matchesTable.$inferSelect

const WINNER_RE = /^Ganador Partido (\d+)$/
const LOSER_RE = /^Perdedor Partido (\d+)$/

// Winner/loser of a finished knockout match. Ties are broken by the penalty
// shootout score; if scores are level with no penalties recorded we can't
// tell, so we return null and leave dependent slots unresolved.
function knockoutOutcome(m: MatchRow): {
  winner: { team: string; flag: string | null }
  loser: { team: string; flag: string | null }
} | null {
  if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) {
    return null
  }
  const home = { team: m.homeTeam, flag: m.homeFlag }
  const away = { team: m.awayTeam, flag: m.awayFlag }

  let homeWins: boolean
  if (m.homeScore !== m.awayScore) {
    homeWins = m.homeScore > m.awayScore
  } else if (m.homePenalties != null && m.awayPenalties != null) {
    if (m.homePenalties === m.awayPenalties) return null
    homeWins = m.homePenalties > m.awayPenalties
  } else {
    return null
  }
  return homeWins
    ? { winner: home, loser: away }
    : { winner: away, loser: home }
}

type SlotPatch = { homeTeam?: string; homeFlag?: string | null; awayTeam?: string; awayFlag?: string | null }

/**
 * Recompute knockout team assignments from current results and persist any
 * newly resolved slots. Safe to call repeatedly and after every result update.
 * Returns the ids of matches whose teams changed.
 */
export async function resolveBracket(): Promise<number[]> {
  const rows = await db.select().from(matchesTable)
  const byId = new Map(rows.map((m) => [m.id, { ...m }]))
  // Accumulated patches per match id; applied to the in-memory copy as we go
  // so chained rounds (final depends on semis depends on quarters) resolve in
  // a single fixpoint loop.
  const patches = new Map<number, SlotPatch>()

  const applyPatch = (id: number, patch: SlotPatch) => {
    const m = byId.get(id)
    if (!m) return
    const existing = patches.get(id) ?? {}
    Object.assign(existing, patch)
    patches.set(id, existing)
    Object.assign(m, patch)
  }

  // 1) Round of 32 from group standings. simulateRound32 returns a resolved
  //    team (or null) for each "1°/2°/3° Grupo" slot once the relevant groups
  //    are fully decided.
  const sim = rows.map((m) => ({
    ...m,
    matchDate: new Date(m.matchDate),
  }))
  const groups = simulateGroups(sim, [], 'actual')

  // Fill placeholders only — never overwrite a slot that already holds a real
  // team. Third-place allocation (FIFA Annexe C) can't be reproduced exactly
  // here, so once a third-place team is set (auto or hand-corrected by an
  // admin) it must stick; re-resolving must not clobber it.
  const r32 = simulateRound32(sim, groups)
  for (const match of r32) {
    const current = byId.get(match.id)
    if (!current) continue
    if (match.home.team && isPlaceholderTeam(current.homeTeam)) {
      applyPatch(match.id, { homeTeam: match.home.team, homeFlag: match.home.flag })
    }
    if (match.away.team && isPlaceholderTeam(current.awayTeam)) {
      applyPatch(match.id, { awayTeam: match.away.team, awayFlag: match.away.flag })
    }
  }

  // 2) Propagate winners/losers into later rounds. Loop to a fixpoint so a
  //    chain of finished matches resolves end to end.
  let changed = true
  while (changed) {
    changed = false
    for (const m of byId.values()) {
      for (const side of ['home', 'away'] as const) {
        const label = side === 'home' ? m.homeTeam : m.awayTeam
        if (!isPlaceholderTeam(label)) continue
        const win = label.match(WINNER_RE)
        const lose = label.match(LOSER_RE)
        if (!win && !lose) continue
        const sourceId = Number((win ?? lose)![1])
        const outcome = knockoutOutcome(byId.get(sourceId)!)
        if (!outcome) continue
        const pick = win ? outcome.winner : outcome.loser
        const patch: SlotPatch =
          side === 'home'
            ? { homeTeam: pick.team, homeFlag: pick.flag }
            : { awayTeam: pick.team, awayFlag: pick.flag }
        applyPatch(m.id, patch)
        changed = true
      }
    }
  }

  // Persist
  const ids: number[] = []
  for (const [id, patch] of patches) {
    await db.update(matchesTable).set(patch).where(eq(matchesTable.id, id))
    ids.push(id)
  }
  return ids
}

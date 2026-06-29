// Pure helpers to simulate the tournament from real results and a user's
// predictions. Group standings use the winner for points (3/1/0); goals and
// goal difference accumulate from real scores when a match is finished, or
// from the user's exact-score prediction otherwise.
//
// Two modes:
//   'actual'      -> real results where a match is finished, predictions ahead
//   'predictions' -> the user's predictions only (ignores real results)

export type SimMode = 'actual' | 'predictions'

type SimMatch = {
  id: number
  homeTeam: string
  awayTeam: string
  homeFlag: string | null
  awayFlag: string | null
  matchDate: Date
  stage: string
  group: string | null
  homeScore: number | null
  awayScore: number | null
  status: string
}

type SimPrediction = {
  matchId: number
  predictedWinner: string
  predictedHomeScore: number | null
  predictedAwayScore: number | null
}

export type Standing = {
  team: string
  flag: string | null
  played: number
  points: number
  goalsFor: number
  goalsAgainst: number
  diff: number
}

export type GroupSim = {
  group: string
  standings: Standing[]
  // matches with a known outcome in this mode (finished and/or predicted)
  decided: number
  // matches already played for real (only counted in 'actual' mode)
  finished: number
  total: number
}

export type PredictionStats = {
  totalPicks: number
  withScore: number
  avgGoals: number | null
  homePicks: number
  drawPicks: number
  awayPicks: number
  favoriteScore: { score: string; count: number } | null
}

export function computeStats(
  predictions: SimPrediction[]
): PredictionStats {
  let withScore = 0
  let goals = 0
  let home = 0
  let draw = 0
  let away = 0
  const scoreCounts = new Map<string, number>()

  for (const p of predictions) {
    if (p.predictedWinner === 'home') home++
    else if (p.predictedWinner === 'draw') draw++
    else if (p.predictedWinner === 'away') away++

    if (p.predictedHomeScore != null && p.predictedAwayScore != null) {
      withScore++
      goals += p.predictedHomeScore + p.predictedAwayScore
      // normalize so 2-1 and 1-2 count as the same scoreline
      const a = Math.max(p.predictedHomeScore, p.predictedAwayScore)
      const b = Math.min(p.predictedHomeScore, p.predictedAwayScore)
      const key = `${a}-${b}`
      scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1)
    }
  }

  let favoriteScore: PredictionStats['favoriteScore'] = null
  for (const [score, count] of scoreCounts) {
    if (!favoriteScore || count > favoriteScore.count) {
      favoriteScore = { score, count }
    }
  }

  return {
    totalPicks: predictions.length,
    withScore,
    avgGoals: withScore > 1 ? Math.round((goals / withScore) * 10) / 10 : null,
    homePicks: home,
    drawPicks: draw,
    awayPicks: away,
    favoriteScore,
  }
}

export function buildFlagMap(matches: SimMatch[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (const m of matches) {
    if (m.homeFlag) flags.set(m.homeTeam, m.homeFlag)
    if (m.awayFlag) flags.set(m.awayTeam, m.awayFlag)
  }
  return flags
}

function compareStandings(a: Standing, b: Standing) {
  return (
    b.points - a.points ||
    b.diff - a.diff ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team)
  )
}

type Outcome = {
  winner: 'home' | 'draw' | 'away'
  homeGoals: number | null
  awayGoals: number | null
  fromResult: boolean
}

// Resolve a match to a single outcome for the chosen mode. Returns null when
// the match has no known outcome yet (no real result and no prediction).
function matchOutcome(
  m: SimMatch,
  pred: SimPrediction | undefined,
  mode: SimMode
): Outcome | null {
  if (
    mode === 'actual' &&
    m.status === 'finished' &&
    m.homeScore != null &&
    m.awayScore != null
  ) {
    const winner =
      m.homeScore > m.awayScore
        ? 'home'
        : m.homeScore < m.awayScore
          ? 'away'
          : 'draw'
    return {
      winner,
      homeGoals: m.homeScore,
      awayGoals: m.awayScore,
      fromResult: true,
    }
  }
  if (pred) {
    return {
      winner: pred.predictedWinner as 'home' | 'draw' | 'away',
      homeGoals: pred.predictedHomeScore,
      awayGoals: pred.predictedAwayScore,
      fromResult: false,
    }
  }
  return null
}

export function simulateGroups(
  matches: SimMatch[],
  predictions: SimPrediction[],
  mode: SimMode = 'predictions'
): GroupSim[] {
  const predMap = new Map(predictions.map((p) => [p.matchId, p]))
  const groups = new Map<string, Map<string, Standing>>()
  const counts = new Map<
    string,
    { decided: number; finished: number; total: number }
  >()

  for (const m of matches) {
    if (m.stage !== 'Fase de Grupos' || !m.group) continue

    const table = groups.get(m.group) ?? new Map<string, Standing>()
    groups.set(m.group, table)
    const count = counts.get(m.group) ?? { decided: 0, finished: 0, total: 0 }
    counts.set(m.group, count)
    count.total++

    for (const [team, flag] of [
      [m.homeTeam, m.homeFlag],
      [m.awayTeam, m.awayFlag],
    ] as const) {
      if (!table.has(team)) {
        table.set(team, {
          team,
          flag,
          played: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          diff: 0,
        })
      }
    }

    const outcome = matchOutcome(m, predMap.get(m.id), mode)
    if (!outcome) continue
    count.decided++
    if (outcome.fromResult) count.finished++

    const homeRow = table.get(m.homeTeam)!
    const awayRow = table.get(m.awayTeam)!
    homeRow.played++
    awayRow.played++

    if (outcome.winner === 'home') homeRow.points += 3
    else if (outcome.winner === 'away') awayRow.points += 3
    else {
      homeRow.points += 1
      awayRow.points += 1
    }

    if (outcome.homeGoals != null && outcome.awayGoals != null) {
      homeRow.goalsFor += outcome.homeGoals
      homeRow.goalsAgainst += outcome.awayGoals
      awayRow.goalsFor += outcome.awayGoals
      awayRow.goalsAgainst += outcome.homeGoals
      homeRow.diff = homeRow.goalsFor - homeRow.goalsAgainst
      awayRow.diff = awayRow.goalsFor - awayRow.goalsAgainst
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, table]) => ({
      group,
      standings: [...table.values()].sort(compareStandings),
      decided: counts.get(group)?.decided ?? 0,
      finished: counts.get(group)?.finished ?? 0,
      total: counts.get(group)?.total ?? 0,
    }))
}

export type ResolvedSlot = {
  label: string
  team: string | null
  flag: string | null
}

export type Round32Match = {
  id: number
  matchDate: Date
  home: ResolvedSlot
  away: ResolvedSlot
}

/**
 * Resolve the round-of-32 placeholders ("1° Grupo A", "3° Grupo A/B/C/D/F")
 * against the simulated standings. Third-place slots are filled with the
 * best 8 thirds, assigned to slots via backtracking over each slot's
 * allowed-groups constraint (FIFA's allocation, simplified).
 */
export function simulateRound32(
  matches: SimMatch[],
  groupSims: GroupSim[],
  // The best-thirds → slot allocation (FIFA Annexe C) can't be reproduced
  // exactly here, so the real bracket sets it by hand. The projection still
  // shows a best-effort assignment (default true); the DB resolution passes
  // false to leave third-place slots as placeholders for an admin to fill.
  assignThirds = true
): Round32Match[] {
  const byGroup = new Map(groupSims.map((g) => [g.group, g]))

  // A group's order is only trustworthy once every match has an outcome
  const placeOf = (group: string, index: number): Standing | null => {
    const sim = byGroup.get(group)
    if (!sim || sim.decided < sim.total) return null
    return sim.standings[index] ?? null
  }

  // Third-place allocation depends on WHICH 8 of the 12 groups' thirds qualify,
  // so it can only be computed once EVERY group is decided. Resolving earlier
  // (when just 8 groups are done) picks the wrong "best 8" and, because results
  // are written incrementally, leaves stale/duplicate teams.
  const allGroupsDecided =
    groupSims.length > 0 && groupSims.every((g) => g.decided === g.total)

  // best 8 third-placed teams across all groups
  const thirds = allGroupsDecided
    ? groupSims
        .filter((g) => g.standings[2])
        .map((g) => ({ group: g.group, row: g.standings[2] }))
        .sort((a, b) => compareStandings(a.row, b.row))
        .slice(0, 8)
    : []

  const r32 = matches
    .filter((m) => m.stage === 'Dieciseisavos de Final')
    .sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime())

  // collect third-place slots with their allowed groups
  const thirdSlots: { matchId: number; side: 'home' | 'away'; allowed: string[] }[] = []
  for (const m of r32) {
    for (const side of ['home', 'away'] as const) {
      const name = side === 'home' ? m.homeTeam : m.awayTeam
      const match3 = name.match(/^3° Grupo ([A-L/]+)$/)
      if (match3) {
        thirdSlots.push({
          matchId: m.id,
          side,
          allowed: match3[1].split('/'),
        })
      }
    }
  }

  // backtracking assignment: slot -> qualified third from an allowed group
  const assignment = new Map<string, { group: string; row: Standing }>()
  const solve = (i: number, used: Set<string>): boolean => {
    if (i === thirdSlots.length) return true
    const slot = thirdSlots[i]
    for (const t of thirds) {
      if (used.has(t.group) || !slot.allowed.includes(t.group)) continue
      used.add(t.group)
      assignment.set(`${slot.matchId}:${slot.side}`, t)
      if (solve(i + 1, used)) return true
      used.delete(t.group)
      assignment.delete(`${slot.matchId}:${slot.side}`)
    }
    // leave the slot unresolved if no candidate fits
    if (solve(i + 1, used)) return true
    return false
  }
  if (assignThirds && thirds.length === 8) solve(0, new Set())

  const resolveSlot = (m: SimMatch, side: 'home' | 'away'): ResolvedSlot => {
    const label = side === 'home' ? m.homeTeam : m.awayTeam
    const flag = side === 'home' ? m.homeFlag : m.awayFlag

    const first = label.match(/^1° Grupo ([A-L])$/)
    if (first) {
      const row = placeOf(first[1], 0)
      return { label, team: row?.team ?? null, flag: row?.flag ?? null }
    }
    const second = label.match(/^2° Grupo ([A-L])$/)
    if (second) {
      const row = placeOf(second[1], 1)
      return { label, team: row?.team ?? null, flag: row?.flag ?? null }
    }
    if (/^3° Grupo /.test(label)) {
      const t = assignment.get(`${m.id}:${side}`)
      return { label, team: t?.row.team ?? null, flag: t?.row.flag ?? null }
    }
    // already a real team (admin filled it in)
    return { label, team: label, flag }
  }

  return r32.map((m) => ({
    id: m.id,
    matchDate: m.matchDate,
    home: resolveSlot(m, 'home'),
    away: resolveSlot(m, 'away'),
  }))
}

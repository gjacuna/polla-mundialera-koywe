// Pure scoring for a single prediction against a final result.
//
// Base points (all stages):
//   +3  correct 1X2 winner (home / draw / away)
//   +5  exact score (both teams' goals)
//
// Elimination bonus (knockout stages only), stacks on top of the base:
//   +1  correct signed goal difference (home - away)
//   +1  exact home-team goals
//   +1  exact away-team goals
//
// Bonuses require the user to have entered a full scoreline. A correct exact
// score therefore yields 3 + 5 + 1 (diff) + 1 (home) + 1 (away) = 11 on a
// knockout match.

// Stages that count as the elimination / knockout phase. Group stage is
// "Fase de Grupos"; everything else is single-elimination.
const ELIMINATION_STAGES = new Set([
  'Dieciseisavos de Final',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinal',
  'Tercer Puesto',
  'Final',
])

export function isEliminationStage(stage: string): boolean {
  return ELIMINATION_STAGES.has(stage)
}

export type ScorablePrediction = {
  predictedWinner: string // 'home' | 'draw' | 'away'
  predictedHomeScore: number | null
  predictedAwayScore: number | null
}

export type ScorableResult = {
  homeScore: number
  awayScore: number
  stage: string
}

export type ScoreBreakdown = {
  result: number // +3 correct 1X2
  exact: number // +5 exact score
  goalDiff: number // +1 elimination, correct signed diff
  homeGoals: number // +1 elimination, exact home goals
  awayGoals: number // +1 elimination, exact away goals
  total: number
}

export function scorePrediction(
  pred: ScorablePrediction,
  result: ScorableResult
): ScoreBreakdown {
  const { homeScore, awayScore, stage } = result

  const actualWinner =
    homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw'

  const breakdown: ScoreBreakdown = {
    result: 0,
    exact: 0,
    goalDiff: 0,
    homeGoals: 0,
    awayGoals: 0,
    total: 0,
  }

  if (pred.predictedWinner === actualWinner) breakdown.result = 3

  const hasScore =
    pred.predictedHomeScore != null && pred.predictedAwayScore != null

  if (hasScore) {
    if (
      pred.predictedHomeScore === homeScore &&
      pred.predictedAwayScore === awayScore
    ) {
      breakdown.exact = 5
    }

    if (isEliminationStage(stage)) {
      if (
        pred.predictedHomeScore! - pred.predictedAwayScore! ===
        homeScore - awayScore
      ) {
        breakdown.goalDiff = 1
      }
      if (pred.predictedHomeScore === homeScore) breakdown.homeGoals = 1
      if (pred.predictedAwayScore === awayScore) breakdown.awayGoals = 1
    }
  }

  breakdown.total =
    breakdown.result +
    breakdown.exact +
    breakdown.goalDiff +
    breakdown.homeGoals +
    breakdown.awayGoals

  return breakdown
}

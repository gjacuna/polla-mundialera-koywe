// Server-only result application, shared by the admin server action and the
// cron results sync. This module is NOT a 'use server' file, so these
// functions are plain imports — they never become public RPC endpoints. Each
// caller is responsible for its own authorization (admin session / cron
// secret) before invoking applyMatchResult.

import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { scorePrediction } from '@/lib/scoring'
import { resolveBracket } from '@/lib/bracket'

// Re-score every prediction for a finished match against its final result.
// Reads the match row so the elimination bonus knows the stage.
export async function rescoreMatch(matchId: number) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match || match.homeScore == null || match.awayScore == null) return

  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId))

  for (const pred of matchPredictions) {
    const { total } = scorePrediction(pred, {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      stage: match.stage,
    })
    await db.update(predictions).set({ points: total }).where(eq(predictions.id, pred.id))
  }
}

// Validate + write a match result, re-score its predictions, and resolve any
// knockout slots this unlocks. Penalties are optional and only meaningful for
// knockout ties.
export async function applyMatchResult(
  matchId: number,
  homeScore: number,
  awayScore: number,
  homePenalties?: number | null,
  awayPenalties?: number | null
) {
  for (const score of [homeScore, awayScore]) {
    if (!Number.isInteger(score) || score < 0 || score > 99) {
      throw new Error('Marcador invalido')
    }
  }
  const pens = [homePenalties, awayPenalties].filter((p) => p != null) as number[]
  if (pens.length === 1) {
    throw new Error('Ingresa ambos marcadores de penales o ninguno')
  }
  for (const p of pens) {
    if (!Number.isInteger(p) || p < 0 || p > 99) {
      throw new Error('Penales invalidos')
    }
  }

  await db
    .update(matches)
    .set({
      homeScore,
      awayScore,
      homePenalties: homePenalties ?? null,
      awayPenalties: awayPenalties ?? null,
      status: 'finished',
    })
    .where(eq(matches.id, matchId))

  await rescoreMatch(matchId)
  // A finished match may resolve the teams of later knockout fixtures, which
  // opens predictions for them.
  await resolveBracket()
}

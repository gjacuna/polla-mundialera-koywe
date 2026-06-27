'use server'

import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin'
import { hasPlaceholderTeams, isPlaceholderTeam } from '@/lib/match-utils'
import { applyMatchResult } from '@/lib/match-results'
import { resolveBracket } from '@/lib/bracket'
import { db } from '@/lib/db'
import { matches, predictions } from '@/lib/db/schema'
import { and, desc, eq, sql, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getMatches() {
  return db.select().from(matches).orderBy(asc(matches.matchDate))
}

export async function getMatchById(id: number) {
  const result = await db.select().from(matches).where(eq(matches.id, id))
  return result[0] || null
}

export async function getUserPredictions() {
  const userId = await getUserId()
  return db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, userId))
    .orderBy(desc(predictions.createdAt))
}

export async function getPredictionForMatch(matchId: number) {
  const userId = await getUserId()
  const result = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.userId, userId), eq(predictions.matchId, matchId)))
  return result[0] || null
}

const VALID_WINNERS = ['home', 'draw', 'away']
const MAX_SCORE = 20

export async function savePrediction(
  matchId: number,
  predictedWinner: string,
  predictedHomeScore?: number,
  predictedAwayScore?: number
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getUserId()

  if (!VALID_WINNERS.includes(predictedWinner)) {
    return { ok: false, error: 'Prediccion invalida' }
  }

  // Scores are optional, but must come as a pair of valid integers
  const hasHome = predictedHomeScore != null
  const hasAway = predictedAwayScore != null
  if (hasHome !== hasAway) {
    return { ok: false, error: 'Ingresa ambos marcadores o ninguno' }
  }
  if (hasHome && hasAway) {
    for (const score of [predictedHomeScore, predictedAwayScore]) {
      if (!Number.isInteger(score) || score! < 0 || score! > MAX_SCORE) {
        return { ok: false, error: 'Marcador invalido' }
      }
    }
    const scoreWinner =
      predictedHomeScore! > predictedAwayScore!
        ? 'home'
        : predictedHomeScore! < predictedAwayScore!
          ? 'away'
          : 'draw'
    if (scoreWinner !== predictedWinner) {
      return { ok: false, error: 'El marcador no coincide con el ganador elegido' }
    }
  }

  const match = await getMatchById(matchId)
  if (!match) {
    return { ok: false, error: 'Partido no encontrado' }
  }
  if (match.status !== 'scheduled' || new Date(match.matchDate) <= new Date()) {
    return { ok: false, error: 'El partido ya comenzo, no se aceptan predicciones' }
  }
  if (hasPlaceholderTeams(match)) {
    return { ok: false, error: 'Los equipos de este partido aun no estan definidos' }
  }

  await db
    .insert(predictions)
    .values({
      userId,
      matchId,
      predictedWinner,
      predictedHomeScore: hasHome ? predictedHomeScore : null,
      predictedAwayScore: hasAway ? predictedAwayScore : null,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        predictedWinner,
        predictedHomeScore: hasHome ? predictedHomeScore : null,
        predictedAwayScore: hasAway ? predictedAwayScore : null,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/')
  revalidatePath('/predictions')
  return { ok: true }
}

export type MatchPredictionStats = {
  home: number
  draw: number
  away: number
  total: number
}

export async function getPredictionStats(): Promise<
  Record<number, MatchPredictionStats>
> {
  const result = await db.execute(sql`
    SELECT "matchId", "predictedWinner", count(*)::int AS count
    FROM predictions
    GROUP BY "matchId", "predictedWinner"
  `)
  const stats: Record<number, MatchPredictionStats> = {}
  for (const row of result.rows as {
    matchId: number
    predictedWinner: string
    count: number
  }[]) {
    const entry = (stats[row.matchId] ??= { home: 0, draw: 0, away: 0, total: 0 })
    if (row.predictedWinner === 'home') entry.home = row.count
    else if (row.predictedWinner === 'draw') entry.draw = row.count
    else if (row.predictedWinner === 'away') entry.away = row.count
    entry.total += row.count
  }
  return stats
}

export async function getLeaderboard() {
  const result = await db.execute(sql`
    SELECT 
      u.id,
      u.name,
      u.email,
      COALESCE(SUM(p.points), 0) as "totalPoints",
      COUNT(p.id) as "totalPredictions"
    FROM "user" u
    LEFT JOIN predictions p ON u.id = p."userId"
    GROUP BY u.id, u.name, u.email
    ORDER BY "totalPoints" DESC, "totalPredictions" DESC
  `)
  return result.rows
}

export async function getUserStats() {
  const userId = await getUserId()
  const result = await db.execute(sql`
    SELECT 
      COALESCE(SUM(points), 0) as "totalPoints",
      COUNT(*) as "totalPredictions",
      COUNT(CASE WHEN points > 0 THEN 1 END) as "correctPredictions"
    FROM predictions 
    WHERE "userId" = ${userId}
  `)
  return result.rows[0]
}

// Admin actions
export async function createMatch(data: {
  homeTeam: string
  awayTeam: string
  homeFlag?: string
  awayFlag?: string
  matchDate: Date
  stage: string
  group?: string
}) {
  await requireAdmin()

  if (!data.homeTeam?.trim() || !data.awayTeam?.trim() || !data.stage?.trim()) {
    throw new Error('Equipos y etapa son obligatorios')
  }
  if (!(data.matchDate instanceof Date) || isNaN(data.matchDate.getTime())) {
    throw new Error('Fecha invalida')
  }

  await db.insert(matches).values(data)
  revalidatePath('/')
  revalidatePath('/admin')
}

export async function updateMatchResult(
  matchId: number,
  homeScore: number,
  awayScore: number,
  homePenalties?: number | null,
  awayPenalties?: number | null
) {
  await requireAdmin()
  await applyMatchResult(matchId, homeScore, awayScore, homePenalties, awayPenalties)

  revalidatePath('/')
  revalidatePath('/leaderboard')
  revalidatePath('/simulacion')
  revalidatePath('/admin')
}

// Admin: resolve knockout teams from results already in the DB. Idempotent.
// Useful as a one-shot when group results were entered before bracket
// resolution existed (so they never triggered it), or any time you want to
// re-fill knockout slots from the current standings. Returns how many matches
// had their teams filled in.
export async function resolveBracketNow(): Promise<{ resolved: number }> {
  await requireAdmin()
  const ids = await resolveBracket()
  revalidatePath('/')
  revalidatePath('/simulacion')
  revalidatePath('/admin')
  return { resolved: ids.length }
}

// Admin: manually set/override the teams of a match. Used to fill knockout
// fixtures when auto-resolution can't (e.g. third-place edge cases) or to fix
// a mistake. Re-scores any predictions already placed against the old teams.
export async function updateMatchTeams(
  matchId: number,
  data: {
    homeTeam: string
    awayTeam: string
    homeFlag?: string | null
    awayFlag?: string | null
  }
) {
  await requireAdmin()

  if (!data.homeTeam?.trim() || !data.awayTeam?.trim()) {
    throw new Error('Ambos equipos son obligatorios')
  }
  if (isPlaceholderTeam(data.homeTeam) || isPlaceholderTeam(data.awayTeam)) {
    throw new Error('Ingresa equipos reales, no marcadores de posicion')
  }

  await db
    .update(matches)
    .set({
      homeTeam: data.homeTeam.trim(),
      awayTeam: data.awayTeam.trim(),
      homeFlag: data.homeFlag?.trim() || null,
      awayFlag: data.awayFlag?.trim() || null,
    })
    .where(eq(matches.id, matchId))

  revalidatePath('/')
  revalidatePath('/simulacion')
  revalidatePath('/admin')
}

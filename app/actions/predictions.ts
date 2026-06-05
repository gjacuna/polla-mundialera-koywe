'use server'

import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin'
import { hasPlaceholderTeams } from '@/lib/match-utils'
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
  awayScore: number
) {
  await requireAdmin()

  for (const score of [homeScore, awayScore]) {
    if (!Number.isInteger(score) || score < 0 || score > 99) {
      throw new Error('Marcador invalido')
    }
  }

  // Update match
  await db
    .update(matches)
    .set({ homeScore, awayScore, status: 'finished' })
    .where(eq(matches.id, matchId))

  // Calculate points for predictions
  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId))

  for (const pred of matchPredictions) {
    let points = 0
    const actualWinner =
      homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw'

    // Points for correct winner
    if (pred.predictedWinner === actualWinner) {
      points += 3
    }

    // Bonus points for exact score
    if (
      pred.predictedHomeScore === homeScore &&
      pred.predictedAwayScore === awayScore
    ) {
      points += 5
    }

    await db
      .update(predictions)
      .set({ points })
      .where(eq(predictions.id, pred.id))
  }

  revalidatePath('/')
  revalidatePath('/leaderboard')
  revalidatePath('/admin')
}

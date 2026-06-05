import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getMatches,
  getUserPredictions,
  getUserStats,
  getPredictionStats,
} from '@/app/actions/predictions'
import { Header } from '@/components/header'
import { MatchCard } from '@/components/match-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Target, Award } from 'lucide-react'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  const [matches, predictions, stats, predictionStats] = await Promise.all([
    getMatches(),
    getUserPredictions(),
    getUserStats(),
    getPredictionStats(),
  ])

  const predictionMap = new Map(predictions.map((p) => [p.matchId, p]))

  return (
    <div className="min-h-screen bg-background">
      <Header
        userName={session.user.name}
        isAdmin={isAdminEmail(session.user.email)}
      />

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Puntos Totales</CardTitle>
              <Trophy className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{String(stats?.totalPoints || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Predicciones</CardTitle>
              <Target className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{String(stats?.totalPredictions || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aciertos</CardTitle>
              <Award className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{String(stats?.correctPredictions || 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Matches */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Partidos del Mundial 2026</h2>
          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aun no hay partidos programados. El administrador debe agregar los partidos.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  prediction={predictionMap.get(match.id) || null}
                  stats={predictionStats[match.id] || null}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

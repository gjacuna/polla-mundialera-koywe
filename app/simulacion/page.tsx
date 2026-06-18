import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getMatches, getUserPredictions } from '@/app/actions/predictions'
import {
  computeStats,
  simulateGroups,
  simulateRound32,
} from '@/lib/simulation'
import { Header } from '@/components/header'
import { SimulationView } from '@/components/simulation-view'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Goal, Target, TrendingUp, Trophy } from 'lucide-react'

export default async function SimulacionPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  const [matches, predictions] = await Promise.all([
    getMatches(),
    getUserPredictions(),
  ])

  const stats = computeStats(predictions)
  const groupsActual = simulateGroups(matches, predictions, 'actual')
  const groupsPred = simulateGroups(matches, predictions, 'predictions')
  const hasResults = matches.some(
    (m) => m.status === 'finished' && m.homeScore != null && m.awayScore != null
  )

  const pickPct = (n: number) =>
    stats.totalPicks > 0 ? Math.round((n / stats.totalPicks) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <Header
        userName={session.user.name}
        isAdmin={isAdminEmail(session.user.email)}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-secondary" />
          <div>
            <h1 className="text-3xl font-bold">Tu Simulacion</h1>
            <p className="text-sm text-muted-foreground">
              Como va el Mundial y como terminaria con tus predicciones
            </p>
          </div>
        </div>

        {/* Prediction stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Goles promedio por partido
              </CardTitle>
              <Goal className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgGoals ?? '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.avgGoals != null
                  ? `en ${stats.withScore} marcadores pronosticados`
                  : 'pronostica al menos 2 marcadores'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Marcadores exactos
              </CardTitle>
              <Target className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.withScore}/{stats.totalPicks}
              </div>
              <p className="text-xs text-muted-foreground">
                predicciones con marcador (+5 pts extra si aciertas)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tu distribucion 1-X-2
              </CardTitle>
              <Trophy className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pickPct(stats.homePicks)}-{pickPct(stats.drawPicks)}-
                {pickPct(stats.awayPicks)}
              </div>
              <p className="text-xs text-muted-foreground">
                % local · empate · visita
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tu marcador favorito
              </CardTitle>
              <Goal className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.favoriteScore?.score ?? '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.favoriteScore
                  ? `lo pronosticaste ${stats.favoriteScore.count} ${stats.favoriteScore.count === 1 ? 'vez' : 'veces'}`
                  : 'aun sin marcadores'}
              </p>
            </CardContent>
          </Card>
        </div>

        <SimulationView
          actual={{
            groups: groupsActual,
            round32: simulateRound32(matches, groupsActual),
          }}
          predictions={{
            groups: groupsPred,
            round32: simulateRound32(matches, groupsPred),
          }}
          hasResults={hasResults}
        />
      </main>
    </div>
  )
}

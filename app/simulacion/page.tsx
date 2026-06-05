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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  const groups = simulateGroups(matches, predictions)
  const round32 = simulateRound32(matches, groups)
  const groupsComplete = groups.filter((g) => g.predicted === g.total).length

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
              Asi se veria el Mundial si tus predicciones se cumplen
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

        {/* Group stage simulation */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Fase de Grupos</h2>
          <Badge variant="secondary">
            {groupsComplete}/12 grupos completos
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Tabla segun tus pronosticos: 3 pts por triunfo, 1 por empate. Los
          goles solo cuentan cuando diste marcador exacto.
        </p>
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((g) => (
            <Card key={g.group} className="py-0 overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                <span className="text-sm font-semibold">Grupo {g.group}</span>
                <span className="text-xs text-muted-foreground">
                  {g.predicted}/{g.total} pronosticados
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="w-6 py-1 pl-3 text-left font-normal">#</th>
                    <th className="py-1 text-left font-normal">Equipo</th>
                    <th className="w-8 py-1 text-right font-normal">Pts</th>
                    <th className="w-10 py-1 pr-3 text-right font-normal">
                      DG
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.standings.map((s, i) => (
                    <tr
                      key={s.team}
                      className={
                        i < 2
                          ? 'bg-primary/5 font-medium'
                          : i === 2
                            ? 'bg-secondary/10'
                            : ''
                      }
                    >
                      <td className="py-1.5 pl-3 text-xs text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="truncate py-1.5">
                        {s.flag} {s.team}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {s.points}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {s.diff > 0 ? `+${s.diff}` : s.diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>

        {/* Round of 32 projection */}
        <h2 className="mb-2 text-2xl font-bold">
          Dieciseisavos de Final proyectados
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Cruces segun tus tablas simuladas. Los terceros se asignan entre los
          8 mejores. Completa los 6 partidos de un grupo para resolver sus
          clasificados.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {round32.map((m) => (
            <Card key={m.id} className="py-3">
              <CardContent className="space-y-1 px-4">
                {[m.home, m.away].map((slot, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    {slot.team ? (
                      <span className="truncate font-medium">
                        {slot.flag} {slot.team}
                      </span>
                    ) : (
                      <span className="truncate text-muted-foreground">
                        {slot.label}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

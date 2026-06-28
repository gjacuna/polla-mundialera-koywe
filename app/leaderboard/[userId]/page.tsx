import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserScorecard, type ScorecardItem } from '@/app/actions/predictions'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const WINNER_LABEL: Record<string, string> = {
  home: 'Local',
  draw: 'Empate',
  away: 'Visitante',
}

function pickLabel(item: ScorecardItem) {
  const hasScore =
    item.predictedHomeScore != null && item.predictedAwayScore != null
  if (hasScore) return `${item.predictedHomeScore}-${item.predictedAwayScore}`
  return WINNER_LABEL[item.predictedWinner] ?? item.predictedWinner
}

function Chips({ item }: { item: ScorecardItem }) {
  const b = item.breakdown
  const parts: string[] = []
  if (b.result) parts.push(`resultado +${b.result}`)
  if (b.exact) parts.push(`exacto +${b.exact}`)
  if (b.goalDiff) parts.push(`dif +${b.goalDiff}`)
  if (b.homeGoals) parts.push(`goles local +${b.homeGoals}`)
  if (b.awayGoals) parts.push(`goles visita +${b.awayGoals}`)
  if (parts.length === 0) return <span className="text-xs text-muted-foreground">sin puntos</span>
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <Badge key={p} variant="secondary" className="text-xs font-normal">
          {p}
        </Badge>
      ))}
    </div>
  )
}

export default async function PlayerScorecardPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const { userId } = await params
  const card = await getUserScorecard(userId)
  if (!card) notFound()

  const correct = card.items.filter((i) => i.breakdown.total > 0).length

  return (
    <div className="min-h-screen bg-background">
      <Header
        userName={session.user.name}
        isAdmin={isAdminEmail(session.user.email)}
      />

      <main className="container mx-auto px-4 py-8">
        <Link
          href="/leaderboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al ranking
        </Link>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-secondary" />
            <div>
              <h1 className="text-2xl font-bold">{card.user.name}</h1>
              <p className="text-sm text-muted-foreground">
                {card.items.length} partidos jugados · {correct} con puntos
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{card.total}</p>
            <p className="text-xs text-muted-foreground">puntos</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalle de Predicciones</CardTitle>
          </CardHeader>
          <CardContent>
            {card.items.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Todavia no tiene predicciones en partidos finalizados
              </p>
            ) : (
              <div className="space-y-2">
                {card.items.map((item) => (
                  <div
                    key={item.matchId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{item.homeFlag ?? '🏳️'}</span>
                        <span className="font-medium">{item.homeTeam}</span>
                        <span className="font-bold">
                          {item.homeScore}-{item.awayScore}
                        </span>
                        <span className="font-medium">{item.awayTeam}</span>
                        <span>{item.awayFlag ?? '🏳️'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(item.matchDate), "d MMM", { locale: es })} ·{' '}
                        {item.stage} · pronóstico: <strong>{pickLabel(item)}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Chips item={item} />
                      <Badge
                        variant={item.breakdown.total > 0 ? 'default' : 'secondary'}
                        className="shrink-0"
                      >
                        +{item.breakdown.total}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getLeaderboard } from '@/app/actions/predictions'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal } from 'lucide-react'

export default async function LeaderboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  const leaderboard = await getLeaderboard()

  return (
    <div className="min-h-screen bg-background">
      <Header
        userName={session.user.name}
        isAdmin={isAdminEmail(session.user.email)}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-secondary" />
          <h1 className="text-3xl font-bold">Ranking</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tabla de Posiciones</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aun no hay participantes con predicciones
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((player, index) => (
                  <Link
                    key={String(player.id)}
                    href={`/leaderboard/${String(player.id)}`}
                    className={`flex items-center justify-between rounded-lg p-4 transition hover:brightness-95 ${
                      player.id === session.user.id
                        ? 'bg-secondary/20 border border-secondary'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center">
                        {index === 0 ? (
                          <Medal className="h-8 w-8 text-yellow-500" />
                        ) : index === 1 ? (
                          <Medal className="h-7 w-7 text-gray-400" />
                        ) : index === 2 ? (
                          <Medal className="h-6 w-6 text-amber-600" />
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {String(player.name)}
                          {player.id === session.user.id && (
                            <Badge variant="secondary" className="ml-2">
                              Tu
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {String(player.totalPredictions)} predicciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {String(player.totalPoints)}
                      </p>
                      <p className="text-xs text-muted-foreground">puntos</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

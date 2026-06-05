'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { savePrediction } from '@/app/actions/predictions'
import { hasPlaceholderTeams } from '@/lib/match-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Clock } from 'lucide-react'

type Match = {
  id: number
  homeTeam: string
  awayTeam: string
  homeFlag: string | null
  awayFlag: string | null
  matchDate: Date
  homeScore: number | null
  awayScore: number | null
  stage: string
  group: string | null
  status: string
}

type Prediction = {
  id: number
  matchId: number
  predictedWinner: string
  predictedHomeScore: number | null
  predictedAwayScore: number | null
  points: number | null
}

type MatchStats = {
  home: number
  draw: number
  away: number
  total: number
}

function MarketBar({ match, stats }: { match: Match; stats: MatchStats }) {
  const pct = (n: number) => Math.round((n / stats.total) * 100)
  const segments = [
    { label: match.homeTeam, value: stats.home, color: 'bg-primary' },
    { label: 'Empate', value: stats.draw, color: 'bg-muted-foreground/40' },
    { label: match.awayTeam, value: stats.away, color: 'bg-secondary' },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>El mercado dice</span>
        <span>
          {stats.total} {stats.total === 1 ? 'prediccion' : 'predicciones'}
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${(s.value / stats.total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{pct(stats.home)}% {match.homeTeam}</span>
        <span>{pct(stats.draw)}% Empate</span>
        <span>{pct(stats.away)}% {match.awayTeam}</span>
      </div>
    </div>
  )
}

export function MatchCard({
  match,
  prediction,
  stats,
}: {
  match: Match
  prediction: Prediction | null
  stats?: MatchStats | null
}) {
  const [selectedWinner, setSelectedWinner] = useState<string>(
    prediction?.predictedWinner || ''
  )
  const [homeScore, setHomeScore] = useState<string>(
    prediction?.predictedHomeScore?.toString() || ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    prediction?.predictedAwayScore?.toString() || ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMatchStarted = new Date(match.matchDate) < new Date()
  const isFinished = match.status === 'finished'
  const teamsTbd = hasPlaceholderTeams(match)
  const canPredict = !isMatchStarted && !isFinished && !teamsTbd

  const handleSave = async () => {
    if (!selectedWinner) return
    setError(null)
    if ((homeScore === '') !== (awayScore === '')) {
      setError('Ingresa ambos marcadores o ninguno')
      return
    }
    setSaving(true)
    try {
      const result = await savePrediction(
        match.id,
        selectedWinner,
        homeScore ? parseInt(homeScore) : undefined,
        awayScore ? parseInt(awayScore) : undefined
      )
      if (result?.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(result?.error || 'No se pudo guardar la prediccion')
      }
    } catch {
      setError('No se pudo guardar la prediccion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={isFinished ? 'opacity-75' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{match.stage}</Badge>
          {match.group && (
            <Badge variant="secondary">Grupo {match.group}</Badge>
          )}
        </div>
        {/* Kickoff is shown in the viewer's timezone; SSR renders the server's,
            so suppress the expected hydration text mismatch. */}
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          <Clock className="h-3 w-3" />
          {format(new Date(match.matchDate), "d 'de' MMMM, HH:mm", {
            locale: es,
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Teams and score display */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-2xl">{match.homeFlag || '🏳️'}</span>
            <span className="text-center text-sm font-medium">
              {match.homeTeam}
            </span>
            {isFinished && (
              <span className="text-2xl font-bold">{match.homeScore}</span>
            )}
          </div>
          <div className="text-xl font-bold text-muted-foreground">vs</div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-2xl">{match.awayFlag || '🏳️'}</span>
            <span className="text-center text-sm font-medium">
              {match.awayTeam}
            </span>
            {isFinished && (
              <span className="text-2xl font-bold">{match.awayScore}</span>
            )}
          </div>
        </div>

        {/* Prediction section */}
        {canPredict ? (
          <div className="space-y-4 rounded-lg bg-muted/50 p-4">
            <p className="text-center text-sm font-medium">Tu prediccion</p>

            {/* Winner selection */}
            <div className="flex justify-center gap-2">
              <Button
                variant={selectedWinner === 'home' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWinner('home')}
              >
                {match.homeTeam}
              </Button>
              <Button
                variant={selectedWinner === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWinner('draw')}
              >
                Empate
              </Button>
              <Button
                variant={selectedWinner === 'away' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWinner('away')}
              >
                {match.awayTeam}
              </Button>
            </div>

            {/* Score prediction */}
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {match.homeTeam}
                </span>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="h-10 w-16 text-center"
                  placeholder="-"
                />
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {match.awayTeam}
                </span>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="h-10 w-16 text-center"
                  placeholder="-"
                />
              </div>
            </div>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSave}
              disabled={!selectedWinner || saving}
              className="w-full"
            >
              {saving ? 'Guardando...' : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Guardado
                </>
              ) : (
                'Guardar prediccion'
              )}
            </Button>
          </div>
        ) : prediction ? (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="mb-2 text-center text-sm font-medium">Tu prediccion</p>
            <div className="flex items-center justify-center gap-4">
              <Badge
                variant={
                  prediction.predictedWinner === 'home'
                    ? 'default'
                    : prediction.predictedWinner === 'draw'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {prediction.predictedWinner === 'home'
                  ? match.homeTeam
                  : prediction.predictedWinner === 'draw'
                    ? 'Empate'
                    : match.awayTeam}
              </Badge>
              {prediction.predictedHomeScore !== null && (
                <span className="text-sm">
                  ({prediction.predictedHomeScore} - {prediction.predictedAwayScore})
                </span>
              )}
            </div>
            {isFinished && prediction.points !== null && (
              <div className="mt-2 text-center">
                <Badge
                  variant={prediction.points > 0 ? 'default' : 'secondary'}
                  className="text-lg"
                >
                  +{prediction.points} pts
                </Badge>
              </div>
            )}
          </div>
        ) : teamsTbd ? (
          <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            Las predicciones se abren cuando se definan los equipos
          </div>
        ) : (
          <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            No hiciste prediccion para este partido
          </div>
        )}

        {/* Market sentiment */}
        {stats && stats.total > 0 && <MarketBar match={match} stats={stats} />}
      </CardContent>
    </Card>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { savePrediction } from '@/app/actions/predictions'
import { hasPlaceholderTeams } from '@/lib/match-utils'
import { MatchCard } from '@/components/match-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, History, LayoutGrid, List, Loader2 } from 'lucide-react'

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

type RowState = {
  winner: string
  saving: boolean
  error?: string
}

const VIEW_STORAGE_KEY = 'matches-view'

function CompactRow({
  match,
  prediction,
}: {
  match: Match
  prediction: Prediction | null
}) {
  const [row, setRow] = useState<RowState | null>(null)

  const isStarted = new Date(match.matchDate) < new Date()
  const isFinished = match.status === 'finished'
  const teamsTbd = hasPlaceholderTeams(match)
  const canPredict = !isStarted && !isFinished && !teamsTbd
  const currentWinner = row?.winner ?? prediction?.predictedWinner ?? null

  const pick = async (winner: string) => {
    if (!canPredict || row?.saving || winner === currentWinner) return
    setRow({ winner, saving: true })
    try {
      const result = await savePrediction(match.id, winner)
      if (result?.ok) {
        setRow({ winner, saving: false })
      } else {
        // inline error, revert to the previous pick
        setRow({
          winner: prediction?.predictedWinner ?? '',
          saving: false,
          error: result?.error || 'Error',
        })
      }
    } catch {
      setRow({
        winner: prediction?.predictedWinner ?? '',
        saving: false,
        error: 'Error al guardar',
      })
    }
  }

  const pickButton = (winner: 'home' | 'draw' | 'away', label: string) => (
    <Button
      variant={currentWinner === winner ? 'default' : 'outline'}
      size="sm"
      className="h-7 w-8 px-0 text-xs"
      disabled={!!row?.saving}
      onClick={() => pick(winner)}
    >
      {label}
    </Button>
  )

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span
        className="w-10 shrink-0 text-xs text-muted-foreground"
        suppressHydrationWarning
      >
        {format(new Date(match.matchDate), 'HH:mm')}
      </span>

      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1 text-sm">
        <span className="min-w-0 truncate text-right">
          {match.homeTeam} {match.homeFlag || ''}
        </span>
        <span className="px-0.5 text-xs text-muted-foreground">
          {isFinished ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
        </span>
        <span className="min-w-0 truncate">
          {match.awayFlag || ''} {match.awayTeam}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canPredict ? (
          <>
            {pickButton('home', '1')}
            {pickButton('draw', 'X')}
            {pickButton('away', '2')}
            <span className="w-4">
              {row?.saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : row && !row.error ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : null}
            </span>
          </>
        ) : teamsTbd ? (
          <span className="text-xs text-muted-foreground">Por definir</span>
        ) : isFinished && prediction?.points != null ? (
          <span className="text-xs font-medium">+{prediction.points} pts</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {currentWinner
              ? currentWinner === 'home'
                ? '1'
                : currentWinner === 'draw'
                  ? 'X'
                  : '2'
              : 'Cerrado'}
          </span>
        )}
      </div>

      {row?.error && (
        <span className="shrink-0 text-xs text-destructive">{row.error}</span>
      )}
    </div>
  )
}

export function MatchesView({
  matches,
  predictions,
  stats,
}: {
  matches: Match[]
  predictions: Prediction[]
  stats: Record<number, MatchStats>
}) {
  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.matchId, p])),
    [predictions]
  )

  // null until mounted: SSR renders the cards grid, then the stored (or
  // heuristic) preference kicks in client-side.
  const [view, setView] = useState<'cards' | 'list' | null>(null)
  // Past matches are hidden by default so the focus stays on what's next.
  const [showPast, setShowPast] = useState(false)
  // Computed only after mount so SSR (which has no reliable "now") renders
  // everything and the past/future split happens client-side without a
  // hydration mismatch.
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'cards' || stored === 'list') {
      setView(stored)
      return
    }
    // First visit: many open matches without a pick -> compact list
    const current = new Date()
    const pending = matches.filter(
      (m) =>
        m.status === 'scheduled' &&
        new Date(m.matchDate) > current &&
        !hasPlaceholderTeams(m) &&
        !predictionMap.has(m.id)
    ).length
    setView(pending > 10 ? 'list' : 'cards')
  }, [matches, predictionMap])

  const selectView = (v: 'cards' | 'list') => {
    setView(v)
    window.localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const isPast = useMemo(() => {
    return (m: Match) =>
      now != null &&
      (m.status === 'finished' || new Date(m.matchDate).getTime() < now)
  }, [now])

  const pastCount = useMemo(
    () => (now == null ? 0 : matches.filter(isPast).length),
    [matches, isPast, now]
  )

  const visibleMatches = useMemo(
    () => (showPast || now == null ? matches : matches.filter((m) => !isPast(m))),
    [matches, showPast, isPast, now]
  )

  const groups = useMemo(() => {
    const byDay = new Map<string, Match[]>()
    for (const m of visibleMatches) {
      const d = new Date(m.matchDate)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const list = byDay.get(key) ?? []
      list.push(m)
      byDay.set(key, list)
    }
    return [...byDay.values()]
  }, [visibleMatches])

  const effectiveView = view ?? 'cards'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Partidos del Mundial 2026</h2>
        <div className="flex shrink-0 items-center gap-1">
          {pastCount > 0 && (
            <Button
              variant={showPast ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPast((v) => !v)}
            >
              <History className="h-4 w-4" />
              {showPast ? 'Ocultar pasados' : `Ver pasados (${pastCount})`}
            </Button>
          )}
          <Button
            variant={effectiveView === 'cards' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Vista de tarjetas"
            onClick={() => selectView('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={effectiveView === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Vista de lista"
            onClick={() => selectView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {visibleMatches.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
          No hay partidos próximos.{' '}
          {pastCount > 0 && (
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setShowPast(true)}
            >
              Ver los {pastCount} partidos pasados
            </button>
          )}
        </Card>
      ) : effectiveView === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictionMap.get(match.id) || null}
              stats={stats[match.id] || null}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            1 = Local · X = Empate · 2 = Visita. Se guarda al tocar. Para
            marcador exacto usa la vista de tarjetas.
          </p>
          {groups.map((group) => (
            <Card key={group[0].id} className="overflow-hidden py-0">
              <div
                className="border-b bg-muted/50 px-3 py-2 text-sm font-medium"
                suppressHydrationWarning
              >
                {(() => {
                  const label = format(
                    new Date(group[0].matchDate),
                    "EEEE d 'de' MMMM",
                    { locale: es }
                  )
                  return label.charAt(0).toUpperCase() + label.slice(1)
                })()}
              </div>
              <div className="divide-y">
                {group.map((match) => (
                  <CompactRow
                    key={match.id}
                    match={match}
                    prediction={predictionMap.get(match.id) || null}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

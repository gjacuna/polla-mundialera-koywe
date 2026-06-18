'use client'

import { useState } from 'react'
import type { GroupSim, Round32Match, SimMode } from '@/lib/simulation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ModeData = {
  groups: GroupSim[]
  round32: Round32Match[]
}

export function SimulationView({
  actual,
  predictions,
  hasResults,
}: {
  actual: ModeData
  predictions: ModeData
  hasResults: boolean
}) {
  // Default to the richer "so far + predictions" view once the cup is under
  // way; if nothing has been played yet both modes are identical anyway.
  const [mode, setMode] = useState<SimMode>(hasResults ? 'actual' : 'predictions')

  const data = mode === 'actual' ? actual : predictions
  const { groups, round32 } = data
  const groupsComplete = groups.filter((g) => g.decided === g.total).length

  return (
    <>
      {hasResults && (
        <div className="mb-6 inline-flex rounded-lg border bg-muted/40 p-1">
          <Button
            variant={mode === 'actual' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('actual')}
          >
            Como va + tus predicciones
          </Button>
          <Button
            variant={mode === 'predictions' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('predictions')}
          >
            Solo tus predicciones
          </Button>
        </div>
      )}

      {/* Group stage simulation */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fase de Grupos</h2>
        <Badge variant="secondary">{groupsComplete}/12 grupos completos</Badge>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode === 'actual'
          ? 'Resultados reales donde ya se jugo, y tus pronosticos para lo que viene. 3 pts por triunfo, 1 por empate.'
          : 'Tabla segun tus pronosticos: 3 pts por triunfo, 1 por empate. Los goles solo cuentan cuando diste marcador exacto.'}
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((g) => (
          <Card key={g.group} className="py-0 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
              <span className="text-sm font-semibold">Grupo {g.group}</span>
              <span className="text-xs text-muted-foreground">
                {mode === 'actual' && g.finished > 0
                  ? `${g.finished} jugados · ${g.decided}/${g.total}`
                  : `${g.decided}/${g.total} pronosticados`}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="w-6 py-1 pl-3 text-left font-normal">#</th>
                  <th className="py-1 text-left font-normal">Equipo</th>
                  <th className="w-8 py-1 text-right font-normal">Pts</th>
                  <th className="w-10 py-1 pr-3 text-right font-normal">DG</th>
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
        Cruces segun las tablas{' '}
        {mode === 'actual' ? 'reales y pronosticadas' : 'pronosticadas'}. Los
        terceros se asignan entre los 8 mejores. Completa los 6 partidos de un
        grupo para resolver sus clasificados.
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
    </>
  )
}

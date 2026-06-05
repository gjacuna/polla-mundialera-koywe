'use client'

import { useState } from 'react'
import { createMatch, updateMatchResult } from '@/app/actions/predictions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

export function AdminPanel({ matches }: { matches: Match[] }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAddMatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    await createMatch({
      homeTeam: formData.get('homeTeam') as string,
      awayTeam: formData.get('awayTeam') as string,
      homeFlag: formData.get('homeFlag') as string,
      awayFlag: formData.get('awayFlag') as string,
      matchDate: new Date(formData.get('matchDate') as string),
      stage: formData.get('stage') as string,
      group: formData.get('group') as string || undefined,
    })

    setLoading(false)
    setShowAddForm(false)
    e.currentTarget.reset()
  }

  const handleUpdateResult = async (
    matchId: number,
    homeScore: string,
    awayScore: string
  ) => {
    if (homeScore === '' || awayScore === '') return
    await updateMatchResult(matchId, parseInt(homeScore), parseInt(awayScore))
  }

  return (
    <div className="space-y-6">
      {/* Add Match Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Agregar Partido</CardTitle>
          <Button
            variant={showAddForm ? 'outline' : 'default'}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancelar' : 'Nuevo Partido'}
          </Button>
        </CardHeader>
        {showAddForm && (
          <CardContent>
            <form onSubmit={handleAddMatch} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="homeTeam">Equipo Local</Label>
                  <Input id="homeTeam" name="homeTeam" required placeholder="Ej: Argentina" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="awayTeam">Equipo Visitante</Label>
                  <Input id="awayTeam" name="awayTeam" required placeholder="Ej: Brasil" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="homeFlag">Bandera Local (emoji)</Label>
                  <Input id="homeFlag" name="homeFlag" placeholder="Ej: 🇦🇷" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="awayFlag">Bandera Visitante (emoji)</Label>
                  <Input id="awayFlag" name="awayFlag" placeholder="Ej: 🇧🇷" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matchDate">Fecha y Hora</Label>
                  <Input id="matchDate" name="matchDate" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage">Etapa</Label>
                  <Input id="stage" name="stage" required placeholder="Ej: Fase de Grupos" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group">Grupo (opcional)</Label>
                  <Input id="group" name="group" placeholder="Ej: A" />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Agregar Partido'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Update Results Section */}
      <Card>
        <CardHeader>
          <CardTitle>Actualizar Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No hay partidos para actualizar
            </p>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <MatchResultRow
                  key={match.id}
                  match={match}
                  onUpdate={handleUpdateResult}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MatchResultRow({
  match,
  onUpdate,
}: {
  match: Match
  onUpdate: (matchId: number, homeScore: string, awayScore: string) => void
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() || '')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onUpdate(match.id, homeScore, awayScore)
    setSaving(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{match.homeFlag || '🏳️'}</span>
          <span className="font-medium">{match.homeTeam}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-medium">{match.awayTeam}</span>
          <span className="text-lg">{match.awayFlag || '🏳️'}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(match.matchDate), "d 'de' MMMM, HH:mm", { locale: es })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          className="h-10 w-16 text-center"
          placeholder="-"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          min="0"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          className="h-10 w-16 text-center"
          placeholder="-"
        />
        <Button
          onClick={handleSave}
          disabled={saving || homeScore === '' || awayScore === ''}
          size="sm"
        >
          {saving ? '...' : 'Guardar'}
        </Button>
        {match.status === 'finished' && (
          <Badge variant="secondary">Finalizado</Badge>
        )}
      </div>
    </div>
  )
}

// Knockout fixtures are seeded with placeholder team names until the
// qualifying teams are known, e.g. "1° Grupo A", "3° Grupo A/B/C/D/F",
// "Ganador Partido 73", "Perdedor Partido 101".
const PLACEHOLDER_RE = /^(\d+°|Ganador|Perdedor)\s/

export function isPlaceholderTeam(team: string) {
  return PLACEHOLDER_RE.test(team)
}

export function hasPlaceholderTeams(match: {
  homeTeam: string
  awayTeam: string
}) {
  return isPlaceholderTeam(match.homeTeam) || isPlaceholderTeam(match.awayTeam)
}

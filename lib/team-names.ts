// Normalize team names so our seeded (Spanish) names match the results feed's
// (English) names. Strips accents/punctuation/case, then applies an alias map
// for names that differ beyond spelling (e.g. "Estados Unidos" -> "USA").
//
// Used by the cron sync to auto-map matches.externalId to API-Football fixture
// ids without any manual step.

// Maps our (Spanish) team name, normalized, to the feed's (TheSportsDB,
// English) name, normalized. Only names that differ after accent/punctuation
// stripping need an entry (e.g. México/Mexico, Catar/Qatar already match).
const ALIASES: Record<string, string> = {
  alemania: 'germany',
  arabiasaudita: 'saudiarabia',
  argelia: 'algeria',
  belgica: 'belgium',
  bosniayherzegovina: 'bosniaherzegovina',
  brasil: 'brazil',
  caboverde: 'capeverde',
  catar: 'qatar',
  coreadelsur: 'southkorea',
  costademarfil: 'ivorycoast',
  croacia: 'croatia',
  curazao: 'curacao',
  egipto: 'egypt',
  escocia: 'scotland',
  espana: 'spain',
  estadosunidos: 'usa',
  francia: 'france',
  inglaterra: 'england',
  irak: 'iraq',
  japon: 'japan',
  jordania: 'jordan',
  marruecos: 'morocco',
  noruega: 'norway',
  nuevazelanda: 'newzealand',
  paisesbajos: 'netherlands',
  rddelcongo: 'drcongo',
  republicacheca: 'czechrepublic',
  sudafrica: 'southafrica',
  suecia: 'sweden',
  suiza: 'switzerland',
  tunez: 'tunisia',
  turquia: 'turkey',
}

export function normalizeTeam(s: string): string {
  const n = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return ALIASES[n] || n
}

// Same UTC calendar day, used to disambiguate rematches.
export function sameDay(a: string | Date, b: string | Date): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)
}

// Normalize team names so our seeded (Spanish) names match the results feed's
// (English) names. Strips accents/punctuation/case, then applies an alias map
// for names that differ beyond spelling (e.g. "Estados Unidos" -> "USA").
//
// Used by the cron sync to auto-map matches.externalId to API-Football fixture
// ids without any manual step.

const ALIASES: Record<string, string> = {
  estadosunidos: 'usa',
  coreadelsur: 'korearepublic',
  iran: 'iriran',
  costademarfil: 'ivorycoast',
  paisesbajos: 'netherlands',
  inglaterra: 'england',
  alemania: 'germany',
  belgica: 'belgium',
  croacia: 'croatia',
  arabiasaudita: 'saudiarabia',
  sudafrica: 'southafrica',
  republicacheca: 'czechrepublic',
  mexico: 'mexico',
  catar: 'qatar',
  emiratosarabesunidos: 'unitedarabemirates',
  caboverde: 'capeverde',
  nuevazelanda: 'newzealand',
  surinam: 'suriname',
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

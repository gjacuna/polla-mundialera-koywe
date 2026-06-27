// Thin client for API-Football (api-sports.io) v3. Used by the cron results
// sync to pull finished fixtures. Requires:
//   API_FOOTBALL_KEY     - your api-sports.io key (header x-apisports-key)
//   API_FOOTBALL_LEAGUE  - competition id (World Cup = 1), default '1'
//   API_FOOTBALL_SEASON  - season year, default '2026'

// Override the base URL (e.g. to point at a local mock) for testing.
const BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io'

// Statuses API-Football reports for a match that has ended.
const FINISHED = new Set(['FT', 'AET', 'PEN'])

export type Fixture = {
  fixtureId: number
  date: string // kickoff ISO, used to map externalIds
  homeName: string
  awayName: string
  status: string // API-Football short status (FT, AET, PEN, NS, ...)
  finished: boolean
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
}

type RawFixture = {
  fixture: { id: number; date: string; status: { short: string } }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
  score: { penalty: { home: number | null; away: number | null } }
}

function config() {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY is not set')
  return {
    key,
    league: process.env.API_FOOTBALL_LEAGUE || '1',
    season: process.env.API_FOOTBALL_SEASON || '2026',
  }
}

async function getFixtures(): Promise<RawFixture[]> {
  const { key, league, season } = config()
  const url = `${BASE}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as { response?: RawFixture[]; errors?: unknown }
  // API-Football returns HTTP 200 with an `errors` object for auth/plan/param
  // problems (invalid key, plan limit, wrong league/season), alongside an empty
  // `response`. Surface those instead of silently treating it as "no fixtures".
  const errs = body.errors
  const hasErrors =
    (Array.isArray(errs) && errs.length > 0) ||
    (errs && typeof errs === 'object' && Object.keys(errs).length > 0)
  if (hasErrors) {
    throw new Error(
      `API-Football error (league=${league}, season=${season}): ${JSON.stringify(errs)}`
    )
  }
  if (!Array.isArray(body.response)) {
    throw new Error(`API-Football unexpected payload: ${JSON.stringify(body)}`)
  }
  return body.response
}

// All fixtures for the competition, normalized. The cron uses this both to
// auto-map externalIds (by team name + date) and to apply finished results.
export async function fetchFixtures(): Promise<Fixture[]> {
  const fixtures = await getFixtures()
  return fixtures.map((f) => ({
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    homeName: f.teams.home.name,
    awayName: f.teams.away.name,
    status: f.fixture.status.short,
    finished: FINISHED.has(f.fixture.status.short),
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    homePenalties: f.score.penalty.home,
    awayPenalties: f.score.penalty.away,
  }))
}

# Auto results, knockout bracket & elimination scoring

## How predictions open for a phase

There is no manual "open phase" switch. A match accepts predictions when **all**
of these hold (see `savePrediction` in `app/actions/predictions.ts`):

- `status === 'scheduled'`
- kickoff (`matchDate`) is in the future
- the match has **real teams**, not placeholders (`hasPlaceholderTeams` in
  `lib/match-utils.ts` — e.g. `"2° Grupo A"`, `"Ganador Partido 73"`)

Knockout fixtures are seeded with placeholder names, so they stay closed until
their teams are known. **Filling in the real teams is what opens predictions.**

That now happens automatically: whenever a result is saved, `resolveBracket()`
(`lib/bracket.ts`) runs and:

1. Resolves round-of-32 (`Dieciseisavos`) slots from the group standings once a
   group is fully decided (reuses the existing `lib/simulation.ts` logic).
2. Propagates `Ganador/Perdedor Partido N` into later rounds when match `N`
   finishes. Match ids equal FIFA match numbers, so `Ganador Partido 73` → the
   winner of match id 73.

So group results → round-of-32 opens; round-of-32 results → round-of-16 opens;
and so on, with no manual step. For edge cases (e.g. third-place allocation) the
admin panel has a **"Definir Equipos (Eliminatorias)"** override.

## Scoring

`lib/scoring.ts` (`scorePrediction`) — applies to every match:

| Bonus | Points | Stages |
|-------|--------|--------|
| Correct 1X2 winner | +3 | all |
| Exact score | +5 | all |
| Correct goal difference | +1 | **elimination only** |
| Exact home-team goals | +1 | **elimination only** |
| Exact away-team goals | +1 | **elimination only** |

Bonuses stack. A perfect knockout scoreline = 3 + 5 + 1 + 1 + 1 = **11**.
Bonuses need a full predicted scoreline; a 1X2-only pick can still earn the +3.

Examples (France–Netherlands, knockout, actual **3-2**):
- Predict **2-1** → correct result (+3) + correct goal diff +1 = **4**
- Predict **4-2** → correct result (+3) + exact away goals (2) +1 = **4**

## Auto-updating results (cron)

### Endpoint
`app/api/cron/sync-results` — fully hands-off. Each run it:

1. **Auto-maps** `externalId` for any match with real teams that isn't mapped
   yet, by matching team name (`lib/team-names.ts` normalizes Spanish↔English)
   + kickoff day. No manual mapping step, ever.
2. **Applies** finished results for mapped matches, re-scores predictions, and
   resolves the bracket — which fills the next round's teams. The following run
   then maps + applies that round, converging up to the final.

- `POST` → apply. Requires `Authorization: Bearer $CRON_SECRET`.
- `GET ?dry=1` → preview (mapping + would-apply) without writing.

Response includes `mapped`, `applied`, `errors`, and **`unmatched`** — matches
with real teams the feed names didn't match. If a team shows up there, add its
alias to `ALIASES` in `lib/team-names.ts` (or set the teams manually in the
admin panel). Placeholder (unresolved) knockout fixtures are simply skipped
until their teams are known.

### Schedule with Upstash QStash
1. Set env vars in Vercel: `CRON_SECRET`, `API_FOOTBALL_KEY`
   (+ `API_FOOTBALL_LEAGUE`, `API_FOOTBALL_SEASON` if not the defaults).
2. Create a QStash **schedule** targeting the deployed URL:
   ```bash
   curl -X POST https://qstash.upstash.io/v2/schedules/https://YOUR_APP/api/cron/sync-results \
     -H "Authorization: Bearer $QSTASH_TOKEN" \
     -H "Upstash-Cron: */15 * * * *" \
     -H "Upstash-Forward-Authorization: Bearer $CRON_SECRET"
   ```
   `Upstash-Forward-*` headers are forwarded to your endpoint, so
   `Upstash-Forward-Authorization` becomes the `Authorization` header we check.
3. Match days run every ~15 min; tighten/loosen the cron as you like. To fire
   right at expected final whistles instead of polling, create one-off QStash
   schedules ~2 hours after each kickoff.

> Vercel Cron works too (it sends `Authorization: Bearer $CRON_SECRET`
> automatically), but the free tier is limited to daily — QStash is the better
> fit for match-day polling.

## Database

Migration `drizzle/0001_*.sql` adds to `matches`: `externalId` (feed mapping),
`homePenalties`, `awayPenalties` (knockout ties — the bracket needs a winner).
Run `npm run db:migrate`.

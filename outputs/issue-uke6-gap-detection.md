# feat: AIS-gap-deteksjon – bakgrunnsjobb + persistering av gap-events (uke 6, steg 1)

## Bakgrunn

Uke 6-milepælen (§7) og v1-DoD (§4) krever én anomaliregel i produksjon:
AIS-gap-deteksjon med varsling. Kjerneverdien (§2, §19) er *going dark near
my sites* — et fartøy som var nær en av mine lokaliteter og så sluttet å sende
AIS, en kjent indikator på uønsket aktivitet.

Uke 6 splittes i to issues for å holde PR-ene små og testbare:

- **Dette issuet (steg 1):** deteksjonsregel + bakgrunnsjobb som skriver
  detekterte gap til DB. Ingen varsling ennå.
- **Oppfølging (steg 2, eget issue):** varsling (e-post/webhook) av nye
  gap-events. Fullfører uke 6-DoD.

## Mål (steg 1)

En regelbasert `@Scheduled`-jobb i `api/` som periodisk finner fartøy som har
«gått mørke» nær en lokalitet, og persisterer hvert gap som en rad i en ny
`gap_events`-tabell. Idempotent: samme pågående gap skal ikke dupliseres.

## Regel: «gått mørke nær lokalitet»

Et fartøy `mmsi` har et gap ved lokalitet `locality_no` når:

1. Siste AIS-posisjon innenfor `radiusMeters` av lokaliteten har msgtime
   `last_seen_at`, og
2. `last_seen_at` er eldre enn `now() - gapThresholdMinutes` (fartøyet er
   stille), og
3. `last_seen_at` faller innenfor `now() - lookbackHours` (vi varsler kun på
   *nylig* aktive fartøy, ikke gammel historikk), og
4. fartøyet har **ingen** AIS-posisjon nyere enn `last_seen_at` *noe sted* i
   boksen.

Punkt 4 er det som skiller «gikk mørkt» fra «seilte vekk»: et fartøy som bare
forlot radiusen sender fortsatt AIS et annet sted; et fartøy som gikk mørkt har
ingen nyere observasjoner i det hele tatt.

## Foreslått implementasjon

### 1. Skjema – Flyway `V3__gap_events.sql`

```sql
-- Forward migration: detected AIS gaps near localities (issue #<N>, week 6).
CREATE TABLE gap_events (
    mmsi          INTEGER     NOT NULL,
    locality_no   INTEGER     NOT NULL REFERENCES localities(locality_no),
    last_seen_at  TIMESTAMPTZ NOT NULL,   -- last AIS msgtime near the locality
    last_latitude  DOUBLE PRECISION NOT NULL,
    last_longitude DOUBLE PRECISION NOT NULL,
    min_distance_m DOUBLE PRECISION NOT NULL,
    detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- natural key doubles as dedup: the same disappearance yields the same
    -- (mmsi, locality_no, last_seen_at), so re-runs ON CONFLICT DO NOTHING
    -- (same pattern as ais_positions, decision log 2026-07-07)
    PRIMARY KEY (mmsi, locality_no, last_seen_at)
);

CREATE INDEX idx_gap_events_detected_at ON gap_events (detected_at DESC);
```

**Merk – kun Flyway, ikke `infra/initdb/`:** `gap_events` skrives kun av API-et.
I motsetning til `localities` (som ingest skriver, jf. 2026-07-13) trenger ikke
den frittstående ingest-dev-flyten denne tabellen, så den lever kun som
forward-migrasjon. Vurder om det bryter med to-stiers-konvensjonen — hvis vi vil
holde `infra/initdb` som komplett speil av skjemaet, legg den også der. Ta
beslutningen i loggen.

### 2. Jobb – `GapDetectionService` (`api/.../anomaly/`)

`@Component` med `@Scheduled(fixedDelayString = "${app.anomaly.gap-check-interval-ms:60000}")`,
samme feilhåndteringsmønster som `PositionBroadcastService` (issue #8): fang og
logg alle exceptions — en ufanget exception fra en scheduled-metode kansellerer
alle framtidige kjøringer og dreper jobben stille til neste restart.

Config-properties (`application.yml`):

- `app.anomaly.gap-check-interval-ms` (default `60000`)
- `app.anomaly.gap-threshold-minutes` (default `30`)
- `app.anomaly.lookback-hours` (default `12`)
- `app.anomaly.radius-meters` (default `1000` — samme 1 km som brief/§25)

### 3. Repository – `GapEventRepository` (JdbcTemplate)

Håndskrevet SQL som resten (jf. 2026-07-09). Deteksjonsspørring, skisse:

```sql
WITH last_near AS (
    SELECT p.mmsi,
           l.locality_no,
           MAX(p.msgtime) AS last_seen_near
    FROM localities l
    JOIN ais_positions p
      ON p.msgtime >= now() - make_interval(hours => ?)      -- lookbackHours
     AND ST_DWithin(p.geom, l.geom, ?)                        -- radiusMeters
    GROUP BY p.mmsi, l.locality_no
)
SELECT ln.mmsi, ln.locality_no, ln.last_seen_near,
       last.latitude, last.longitude,
       ST_Distance(last.geom, l.geom) AS min_distance_m
FROM last_near ln
JOIN localities l   ON l.locality_no = ln.locality_no
JOIN ais_positions last
     ON last.mmsi = ln.mmsi AND last.msgtime = ln.last_seen_near
WHERE ln.last_seen_near < now() - make_interval(mins => ?)    -- gapThresholdMin
  AND NOT EXISTS (                                            -- truly dark
      SELECT 1 FROM ais_positions p2
      WHERE p2.mmsi = ln.mmsi AND p2.msgtime > ln.last_seen_near
  );
```

Insert med `ON CONFLICT (mmsi, locality_no, last_seen_at) DO NOTHING` — pågående
gap re-emitteres ikke. `last_near` er tidsavgrenset først (chunk exclusion på
hypertabellen) og bruker GiST-indeksen på begge geography-kolonnene, som i #12.

### 4. Tester

Testcontainers-integrasjonstest à la `LocalityRepositoryIntegrationTest`:

- Fartøy sett nær lokalitet, så stille > terskel, ingen nyere posisjon → **ett**
  gap_event.
- Fartøy som seilte vekk (nyere posisjon utenfor radius) → **ingen** event.
- Fartøy stille men innenfor lookback-grensa nettopp → ingen event (fersk).
- Dedup: kjør deteksjonen to ganger → fortsatt én rad.

Enhetstest av `GapDetectionService` med mocket repo for å verifisere
feil-logges-ikke-krasjer-oppførselen.

## Definition of Done

- [ ] `V3__gap_events.sql` kjører grønt via Flyway på oppstart
- [ ] `GapDetectionService` kjører på timer, fanger + logger feil
- [ ] `GapEventRepository` detekterer gap etter regelen over, dedup via ON CONFLICT
- [ ] Config-properties dokumentert i `application.yml` med defaults
- [ ] Integrasjons- og enhetstester grønne i CI (`mvn test`)
- [ ] PR refererer issuen (`Closes #<N>`)

## Utenfor scope (→ egne issues)

- Varsling e-post/webhook av nye gap-events (uke 6, steg 2)
- Lukking/resolving av gap når fartøyet dukker opp igjen
- Eksponering av gap_events i REST/UI
- ML-basert loitering-klassifisering (backlog/v2, §44)

## Meta

- Branch: `feat/ais-gap-detection`
- Label: `v1`
- Avhenger av #11/#12 (localities + geom) — allerede på `main`.

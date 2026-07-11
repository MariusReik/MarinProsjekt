# Prosjektbrief: Marin overvåkningsplattform (arbeidstittel)

Sist oppdatert: 5. juli 2026. Dette dokumentet er kilden til sannhet for scope, arkitektur og beslutninger. Ved tvil underveis: velg det som gjør v1 ferdig raskere.

## 1. Formål

CV-prosjekt for jobbsøking i 2027, bygget av én person (masterstudent, UiB/HVL, thesis i SFI Smart Ocean fra høsten 2026). Prosjektet skal (a) demonstrere fullstack- og dataplattform-kompetanse på produksjonsnivå, (b) være tematisk koblet til havteknologi/Bergen-markedet, og (c) ha et reelt, om enn sekundært, B2B-produktspor mot havbruksnæringen.

## 2. Problemdefinisjon

Norske kystdata er åpne men fragmenterte. AIS-posisjoner (Barentswatch), oppdrettslokaliteter og fiskehelsedata (Barentswatch Fiskehelse), bølgevarsel (Barentswatch) og værobservasjoner (MET Frost) ligger i separate API-er uten samlet sanntidsbilde. Aktører med interessepunkter langs kysten – primært driftsledere i havbruk – kan i dag ikke enkelt svare på:

- Hvilke fartøy har oppholdt seg nær anleggene mine, og når?
- Har fartøy i mitt område sluttet å sende AIS («going dark» – en kjent indikator på uønsket aktivitet)?
- Hva er miljøforholdene rundt lokalitetene mine akkurat nå?

Eksisterende løsninger er enten enterprise-priset (MarineTraffic o.l.) eller rene visningsportaler uten varsling, historikk per interessepunkt eller avviksdeteksjon.

**Kjerneverdi: kontekstualisering.** Ikke «vis skip på kart», men fartøysaktivitet tolket relativt til brukerens lokasjoner, med automatisk flagging av avvik.

## 3. Målgruppe og brukerhistorier (v1)

Primær persona: driftsleder/HMS-ansvarlig ved oppdrettsanlegg. Sekundært: havneadministrasjon, forskere.

1. Som driftsleder vil jeg se all fartøysaktivitet innenfor konfigurerbar radius (default 1 km) av lokalitetene mine de siste 7 dagene, som spor på kart og som hendelsesliste.
2. Som driftsleder vil jeg varsles (e-post/webhook) når et fartøy slutter å sende AIS-signal innenfor mitt område (gap-deteksjon).
3. Som bruker vil jeg se live fartøystrafikk og miljøforhold (bølgehøyde, temperatur) på ett kart for Vestlandet.

## 4. Scope

### v1 (definition of done – alt annet er forbudt til dette er ferdig)

- Ingest av Barentswatch live AIS-strøm, geografisk filtrert til en boks rundt Vestlandet
- Lagring i PostgreSQL med TimescaleDB (tidsserier) og PostGIS (geospatiale spørringer)
- Retention/downsampling-policy for rådata (f.eks. rådata 30 dager, nedsamplet lenger)
- Oppdrettslokaliteter hentet fra Fiskehelse-API og lagret som interessepunkter
- API-lag: REST for historikk/spørringer, WebSocket for live posisjoner
- Kart-dashboard (React + MapLibre GL): live fartøy, historiske spor, lokaliteter som kartlag
- Én anomaliregel i produksjon: AIS-gap-deteksjon med varsling via e-post/webhook
- PostGIS-spørring «fartøy innenfor radius av lokalitet» eksponert i API og UI
- Docker Compose for hele stacken, GitHub Actions CI/CD, deploy på VPS/AWS
- README med arkitekturdiagram, demo-GIF og roadmap

### Eksplisitt ikke i v1 (backlog/v2)

- ML-basert anomalideteksjon (loitering-klassifisering, trajektorie-prediksjon)
- Brukerkontoer, auth og multi-tenant-arkitektur
- Flere regioner enn Vestlandet
- Bølge-/værdata utover enkel visning (korrelasjonsanalyse er v2)
- Mobilapp og native varsler
- Avansert dashboard-personalisering og flere brukerroller

## 5. Arkitektur

```
[Barentswatch AIS live-strøm]   [Miljødata: bølger, MET Frost]
              \                       /
               v                     v
        [Ingest-tjeneste (Node/TypeScript)]
          - token-håndtering, reconnect
          - geografisk filter, normalisering
                     |
                     v
        [PostgreSQL + TimescaleDB + PostGIS]
              /                  \
             v                    v
   [API-lag (Spring Boot)]   [Anomalijobb (regelbasert)]
    - REST + WebSocket        - AIS-gap-deteksjon
             |                        |
             v                        v
   [Dashboard (React+MapLibre)]  [Varsling: e-post/webhook]
```

## 6. Teknologivalg og begrunnelse

- **Ingest: Node/TypeScript.** Strømhåndtering og JSON-prosessering med lav friksjon; utvikleren er sterk i TS.
- **API: Spring Boot (Java).** Bevisst CV-signal mot Bergens enterprise-marked; utvikleren har Spring-erfaring. Alternativ vurdert: alt i TS (raskere, men smalere signal).
- **DB: Postgres + TimescaleDB + PostGIS.** Tidsserier + geospatiale spørringer er kjernen i domenet. Hypertables, kontinuerlige aggregater og ST_DWithin-spørringer er sentrale intervjutemaer.
- **Frontend: React + MapLibre GL.** Open source, ingen lisenskostnad, WebGL-ytelse for mange markører.
- **Infra: Docker Compose lokalt, GitHub Actions CI/CD, deploy på Hetzner VPS eller AWS EC2.** AWS-varianten foretrekkes hvis IaC (Terraform) rekkes – kobler mot AWS Cloud Practitioner-sertifisering.
- **Observability (uke 7, hvis tid): Prometheus + Grafana** for meldinger/sekund, ingest-lag og feilrater.

## 7. Milepæler (8 uker)

- **Uke 1:** Repo, Barentswatch API-klient og token-flyt, koble på AIS-strømmen, dump rådata ~24 t for å forstå volum/format.
- **Uke 2:** DB-schema, ingest → TimescaleDB med geografisk filter, retention-policy.
- **Uke 3–4:** Spring Boot-API (REST + WebSocket), kart med live fartøysposisjoner. Første demo.
- **Uke 5:** Oppdrettslokaliteter fra Fiskehelse-API på kartet, radius-spørring i PostGIS.
- **Uke 6:** AIS-gap-deteksjon som bakgrunnsjobb, varsling.
- **Uke 7:** CI/CD, deploy, ev. Prometheus/Grafana.
- **Uke 8:** Polering, README, 60-sekunders demo-video, CV-formulering.

## 8. Risikoer og mottiltak

- **AIS-datavolum:** Full norsk strøm er stor. Geografisk filter implementeres i uke 1, ikke senere.
- **Scope creep:** Nye ideer opprettes som GitHub Issue med label `backlog`, aldri implementeres før v1 er ferdig.
- **API-endringer/nedetid hos Barentswatch:** Ingest må tåle reconnect og lagre siste kjente tilstand; feil skal logges, ikke krasje pipeline.
- **Tidsklemme (TA-jobb, thesis-oppstart):** Milepælene er ukesbaserte men fleksible; rekkefølgen er hellig, kalenderen er ikke.

## 9. Beslutningslogg

- 2026-07-05: Valgt marin sensorplattform over 6 alternative konsepter (scoret høyest på matrise: teknisk dybde, datatilgang, Bergen-relevans, B2B-potensial).
- 2026-07-05: Anomali #1 = AIS-gap-deteksjon (regelbasert), ikke ML. ML utsatt til v2.
- 2026-07-05: To-språks stack (TS ingest + Spring Boot API) valgt over ren TS for bredere CV-signal.
- 2026-07-05: Arbeidsflyt = GitHub Flow: feature-branches + PR med squash merge til `main`; oppgaver og backlog som GitHub Issues (backlog flyttet fra README).
- 2026-07-07: DB-schema leveres som initdb-SQL i dev (kjøres ved tomt volum); ordentlig migrasjonsverktøy (Flyway) innføres sammen med Spring Boot-API-et i uke 3–4.
- 2026-07-07: `ais_positions` bruker naturlig nøkkel (mmsi, msgtime) uten surrogat-id; PK-en fungerer samtidig som dedup ved reconnect-replays (`ON CONFLICT DO NOTHING`).
- 2026-07-07: Retention: rådata 30 dager; continuous aggregate med 5-minutters bøtter per fartøy beholdes 365 dager.
- 2026-07-07: Ingest bruker live-strømmen (per brief), ikke polling; eksisterende poll-løkke beholdes som dokumentert fallback. Begrunnelse: gap-deteksjon krever kontinuerlige observasjoner.
- 2026-07-07: Geografisk boks for v1: 59,0–62,5°N, 3,5–8,0°Ø (Vestland fylke + margin). ~1200 fartøy i boksen ved test 2026-07-06.
- 2026-07-08: Spring Boot-skeleton (issue #6): Maven (ikke Gradle) — Marius er mer vant med Maven. Spring Boot 3.5.16 (siste patch i 3.x-linja, ikke 4.1 som er «current stable») og Java 21 LTS, valgt for kjent/velprøvd oppsett fremfor nyeste major-versjon. GroupId `no.marinplattform` er placeholder til prosjektnavn er avgjort (§10).
- 2026-07-08: Flyway innføres i api/ som avtalt i uke 3–4-planen, men eier kun migrasjoner *fremover* (V2+). `infra/initdb/*.sql` rører vi ikke — det er fortsatt det som bootstraper et tomt dev-volum, uavhengig av om API-et kjører. Begrunnelse: `baselineOnMigrate` kjører aldri SQL-en i baseline-migrasjonen (V1), den bare stempler historikken — å fjerne skjemaet fra initdb ville brutt ingest sin frittstående dev-flyt (`docker compose up` + `npm run dev` uten at API-et noensinne har kjørt).
- 2026-07-08: En minimal CI-workflow (build+test på PR for api/ og ingest/, ingen deploy) hentes frem fra uke 7-milepælen og settes opp nå, som unntak fra at rekkefølgen ellers er hellig. Begrunnelse: fanger kompileringsfeil Claude ikke kan verifisere i sandkassen (ingen Maven/nett-tilgang der). Full CI/CD+deploy står fortsatt i uke 7 som planlagt.
- 2026-07-09: Issue #7 (REST-endepunkter) bruker JdbcTemplate, ikke JPA/Hibernate. Begrunnelse: `ais_positions` har en generert PostGIS `GEOGRAPHY`-kolonne og leses dels via Timescale continuous aggregates — håndskrevet SQL er enklere å resonnere om enn Hibernate Spatial-mapping, og gir full kontroll på `ST_DWithin`/`time_bucket` som briefen peker ut som sentrale. `/api/positions/latest` er tidsvindu-begrenset (default 15 min, tak 60 min) for å utnytte chunk exclusion mot hypertable fremfor å skanne hele 30-dagers rådata.
- 2026-07-11: Issue #8 (WebSocket live posisjoner) løses med STOMP-over-WebSocket (Spring `spring-boot-starter-websocket`), ikke rå WebSocket eller Postgres LISTEN/NOTIFY. `PositionBroadcastService` poller `ais_positions` hvert 2. sekund (konfigurerbart, `app.websocket.broadcast-interval-ms`) for rader nyere enn forrige broadcast og pusher dem til `/topic/positions`. Begrunnelse: API-et og ingest deler kun databasen (jf. arkitekturdiagrammet i §5) — polling holder dem frikoblet uten LISTEN/NOTIFY-triggere eller en egen meldingskø, og er det minste steget som gir en fungerende live-strøm. Ingen SockJS-fallback: dashbordet (#9) er moderne nettlesere med nativ WebSocket-støtte. Ingen auth ennå (§4, backlog #21) — STOMP-endepunktet `/ws` har derfor åpne CORS-origins inntil videre.

- 2026-07-11: Issue #9 (React+MapLibre-dashboard) bygges med Vite + React + TypeScript i `web/`. Fartøy rendres som et data-drevet MapLibre `circle`-lag (GeoJSON-source oppdatert imperativt på 1 s-intervall, frikoblet fra WebSocket-frekvensen) fremfor DOM-markører — utnytter WebGL-ytelsen briefen (§6) peker på for ~1200 fartøy i boksen. Kartstil er OSM-raster inline (`src/map/mapStyle.ts`), valgt for å slippe tile-server-API-nøkkel, jf. «ingen lisenskostnad». Live-strøm via `@stomp/stompjs` mot `/topic/positions` (nativ WebSocket, ingen SockJS — samme valg som #8), med startsnapshot fra `GET /api/positions/latest`.
- 2026-07-11: REST-endepunktene (#7) har ingen CORS-config, og global CORS på API-et utsettes bevisst til auth lander (backlog #21). Løst i #9 med en Vite dev-proxy: `/api` og `/ws` proxes til `localhost:8080` (`web/vite.config.ts`), så nettleseren snakker med én origin i dev. I prod serveres de bygde assetsene bak samme reverse-proxy som API-et (uke 7-deploy), så de relative stiene fungerer uendret. Ingen endring i `api/`.
- 2026-07-11: #9 inkluderer «klikk fartøy → tegn historisk spor» via eksisterende `GET /api/vessels/{mmsi}/track` (siste 24 t). Innenfor v1 DoD («historiske spor»), og utnytter et endepunkt som ellers sto ubrukt. #9 erstatter samtidig den gamle Leaflet-spiken `web/index.html` (Node-API-mål) — lukker delvis #31 (spike-pensjonering); resten av #31 (`ingest/src/api.ts`) står igjen.

## 10. Åpne spørsmål

- Prosjektnavn (kandidater vurderes: noe norsk/maritimt, kort, ledig domene og GitHub-navn)
- Hetzner vs AWS for deploy

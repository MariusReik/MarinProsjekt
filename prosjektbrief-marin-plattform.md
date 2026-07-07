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

## 10. Åpne spørsmål

- Prosjektnavn (kandidater vurderes: noe norsk/maritimt, kort, ledig domene og GitHub-navn)
- Hetzner vs AWS for deploy
- Nøyaktig geografisk boks for v1 (forslag: Vestland fylke ± margin)

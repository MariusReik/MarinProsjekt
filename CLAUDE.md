# Marin overvåkningsplattform

**Source of truth: [prosjektbrief-marin-plattform.md](./prosjektbrief-marin-plattform.md).**
Les den før du foreslår noe. Scope, arkitektur, milepæler og beslutningslogg ligger der – ikke dupliser innhold hit.

## Kjøreregler

- v1-scope i briefen er hellig. Ideer utenfor scope → GitHub Issue med label `backlog`, aldri implementer før v1 er ferdig.
- Stack er låst: Node/TypeScript (ingest), Spring Boot (API), Postgres + TimescaleDB + PostGIS, React + MapLibre GL, Docker Compose, GitHub Actions. Ikke foreslå alternativer uten sterk grunn.
- Produksjonskvalitet: feilhåndtering, logging, tester der det gir mening. Ingest skal tåle reconnect – logg feil, ikke krasj pipeline.
- Utvikleren jobber alene ved siden av studier og TA-jobb: foreslå alltid det minste steget som gir fremdrift, ikke store omskrivinger.
- Ved arkitektur- eller scopebeslutninger: minn om å oppdatere beslutningsloggen i briefen.
- Kommunikasjon på norsk; kode, kodekommentarer og commit-meldinger på engelsk.

## Arbeidsflyt (GitHub Flow)

- `main` er alltid deploybar. Aldri commit direkte til `main` (unntak: triviell docs-fix).
- Én branch per oppgave: `feat/<kort-navn>`, `fix/<kort-navn>`, `chore/<kort-navn>`, `docs/<kort-navn>`. Eksempel: `feat/ais-ingest-client`.
- Hver oppgave starter som GitHub Issue; branch og PR refererer issuen (`Closes #12` i PR-beskrivelsen).
- Merge via PR med **squash merge**; branch slettes etter merge.
- Labels: `backlog` (utenfor v1 – røres ikke), `bug`, `v1`. Milepæler kan følge ukene i briefen.
- Commit-meldinger: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), på engelsk.

## Struktur

```
ingest/   Node/TypeScript – Barentswatch AIS-ingest
api/      Spring Boot – REST + WebSocket
web/      React + MapLibre GL – dashboard
infra/    Docker Compose, CI/CD, deploy
docs/     Arkitekturnotater, ADR-er o.l. (briefen ligger i rota)
```

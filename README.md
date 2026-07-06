# Marin overvåkningsplattform (arbeidstittel)

Real-time marine monitoring for the Norwegian west coast: AIS vessel tracking
contextualized against user-defined points of interest (aquaculture sites),
with AIS-gap anomaly detection and alerting.

Se [prosjektbriefen](./prosjektbrief-marin-plattform.md) for scope, arkitektur og milepæler.

## Status

Uke 1 – ingest-scaffold merget. Neste: Barentswatch token-flyt, AIS-strøm og første persistens i PostgreSQL.

## Local development

- Install dependencies in the ingest service:
  - `cd ingest`
  - `npm install`
- Start PostgreSQL with Docker Compose:
  - `docker compose -f infra/docker-compose.yml up -d`
- Run the ingest service:
  - `cd ingest`
  - `npm run dev`

The web demo can be opened from [web/index.html](web/index.html) while the ingest API is running on port 3000.

## Backlog og neste steg

Alt arbeid spores som [GitHub Issues](../../issues): v1-oppgaver med label `v1`,
ideer utenfor v1 med label [`backlog`](../../issues?q=is%3Aissue+label%3Abacklog) –
de implementeres aldri før v1 er ferdig. Se prosjektbriefen for scope og milepæler.

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

Prioriterte arbeidspakker for prosjektet:

1. Ingest hardening og observability
   - robust feilhåndtering, retries og bedre logging
   - stabil polling- og reconnect-flyt for Barentswatch

2. Databaselagring og modellering
   - komplett PostgreSQL-lagring for AIS-posisjoner
   - schema for historiske spor, lokaliteter og anomalier

3. API og dashboard
   - REST-endepunkter for siste og historiske posisjoner
   - enkel web-demo med kartvisning og filtrering

4. Anomalideteksjon og varsling
   - AIS-gap-detektering og første varsling via webhook/e-post

Ideer utenfor v1 ligg som GitHub Issues med label `backlog` og implementeres først når v1 er ferdig.

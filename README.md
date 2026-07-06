# Marin overvåkningsplattform (arbeidstittel)

Real-time marine monitoring for the Norwegian west coast: AIS vessel tracking
contextualized against user-defined points of interest (aquaculture sites),
with AIS-gap anomaly detection and alerting.

Se [prosjektbriefen](./prosjektbrief-marin-plattform.md) for scope, arkitektur og milepæler.

## Status

Uke 1 – ingest-scaffold merget. Neste: Barentswatch token-flyt og AIS-strøm.

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

## Backlog

Ideer utenfor v1 ligger som [GitHub Issues med label `backlog`](../../issues?q=is%3Aissue+label%3Abacklog) – implementeres aldri før v1 er ferdig.

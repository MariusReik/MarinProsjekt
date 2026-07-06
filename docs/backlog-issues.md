# Backlog and issue proposals

The following workstreams are written in a professional issue-style format so they can be copied into GitHub Issues when needed.

## Epic 1: Ingest hardening and observability
**Goal:** Make the ingest pipeline production-ready and resilient to external API failures.

### Scope
- Add retry and backoff logic for Barentswatch requests.
- Improve reconnect handling and failure isolation.
- Add structured logging for ingest runs, errors, and cycle timing.
- Expose health and operational metrics for the service.

### Acceptance criteria
- Failed fetches do not crash the ingest loop.
- Logs clearly show ingestion status and failure causes.
- The service can recover after transient outages.

## Epic 2: Persistent storage and data modeling
**Goal:** Move from local persistence to a durable database-backed storage layer.

### Scope
- Use PostgreSQL as the default storage backend for AIS positions.
- Define a stable schema for AIS positions, vessel tracks, and metadata.
- Support loading the latest stored positions through the API layer.
- Prepare for future TimescaleDB and PostGIS extensions.

### Acceptance criteria
- AIS positions are persisted to PostgreSQL by default.
- The service can read back the latest stored batch through the API.
- The storage layer is abstracted so alternative backends can be swapped in.

## Epic 3: API and dashboard experience
**Goal:** Expose ingested data in a usable way for the web experience.

### Scope
- Build REST endpoints for latest and historical AIS positions.
- Provide a simple dashboard view with map-based rendering.
- Support basic filtering by vessel, time window, and region.
- Prepare the API for future web and mobile clients.

### Acceptance criteria
- The web demo can load and display positions from the ingest API.
- The API returns structured, documented JSON payloads.
- The UI can refresh data without a full page reload.

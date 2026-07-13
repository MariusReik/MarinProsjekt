-- Forward migration: aquaculture localities as points of interest (issue #11).
--
-- Idempotent (IF NOT EXISTS) on purpose. The project maintains two bootstrap
-- paths in parallel (decision log 2026-07-08): infra/initdb/*.sql bootstraps a
-- fresh dev volume, while Flyway owns real forward migrations (V2+). This table
-- must exist for both the standalone ingest dev flow (created by
-- infra/initdb/04-localities.sql) and API-driven / CI databases (created here).
-- On a fresh dev volume the initdb script runs first, so this migration is a
-- no-op; on an existing V1 database or a Flyway-only environment it creates the
-- table. IF NOT EXISTS reconciles both without a create-vs-create conflict.

CREATE TABLE IF NOT EXISTS localities (
    locality_no  INTEGER PRIMARY KEY,          -- natural key from Fiskehelse
    name         TEXT NOT NULL,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    -- geography => ST_DWithin works in meters (radius queries, week 5)
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- last refresh from the API
);

CREATE INDEX IF NOT EXISTS idx_localities_geom ON localities USING GIST (geom);

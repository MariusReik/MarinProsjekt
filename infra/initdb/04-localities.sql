-- Aquaculture localities (Fiskehelse) as points of interest (issue #11).
-- Runs on first init of an empty volume (dev), same as 02-schema.sql. This
-- keeps the standalone ingest dev flow working (docker compose up + the
-- localities refresher) without the Spring Boot API ever running. The API's
-- Flyway V2 migration mirrors this idempotently for existing/CI databases.

CREATE TABLE localities (
    locality_no  INTEGER PRIMARY KEY,          -- natural key from Fiskehelse
    name         TEXT NOT NULL,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    -- geography => ST_DWithin works in meters (radius queries, week 5)
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- last refresh from the API
);

CREATE INDEX idx_localities_geom ON localities USING GIST (geom);

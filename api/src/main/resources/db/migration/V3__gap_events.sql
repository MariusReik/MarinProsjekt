-- Forward migration: detected AIS gaps near localities (week 6, gap detection).
--
-- API-owned table: only GapDetectionService writes it. Unlike `localities`
-- (which the ingest service writes, decision log 2026-07-13), the standalone
-- ingest dev flow never touches gap_events, so this lives ONLY as a Flyway
-- forward migration and is intentionally NOT mirrored into infra/initdb/*.sql.
CREATE TABLE gap_events (
    mmsi           INTEGER          NOT NULL,
    locality_no    INTEGER          NOT NULL REFERENCES localities(locality_no),
    last_seen_at   TIMESTAMPTZ      NOT NULL,  -- last AIS msgtime seen near the locality
    last_latitude  DOUBLE PRECISION NOT NULL,
    last_longitude DOUBLE PRECISION NOT NULL,
    min_distance_m DOUBLE PRECISION NOT NULL,  -- closest approach at last_seen_at
    detected_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    -- Natural key doubles as dedup: the same disappearance always yields the
    -- same (mmsi, locality_no, last_seen_at), so re-runs INSERT ... ON CONFLICT
    -- DO NOTHING and never re-emit an ongoing gap (same pattern as
    -- ais_positions, decision log 2026-07-07).
    PRIMARY KEY (mmsi, locality_no, last_seen_at)
);

-- Newest-first reads (future alerting/UI) hit an index rather than a full scan.
CREATE INDEX idx_gap_events_detected_at ON gap_events (detected_at DESC);

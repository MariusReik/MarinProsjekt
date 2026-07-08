-- Baseline migration: mirrors infra/initdb/02-schema.sql and 03-retention.sql.
--
-- This does NOT run against dev/prod databases bootstrapped by infra/initdb —
-- Flyway is configured with baseline-on-migrate=true and baseline-version=1
-- (see application.yml), which stamps the migration history without
-- executing this file's SQL. It exists so:
--   1. the schema is documented as version-controlled history, and
--   2. a fresh environment that skips infra/initdb entirely (CI, future
--      hosting setup) could in principle run this to bootstrap from scratch.
--
-- Real schema changes from here on are new Vn__*.sql files, applied for
-- real by Flyway on every app startup.

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE vessels (
    mmsi       INTEGER PRIMARY KEY,
    name       TEXT,
    ship_type  SMALLINT,
    last_seen  TIMESTAMPTZ NOT NULL
);

CREATE TABLE ais_positions (
    mmsi          INTEGER      NOT NULL,
    msgtime       TIMESTAMPTZ  NOT NULL,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    sog           REAL,      -- speed over ground, knots
    cog           REAL,      -- course over ground, degrees
    true_heading  SMALLINT,
    rate_of_turn  REAL,
    nav_status    SMALLINT,
    -- geography => ST_DWithin works in meters (radius queries, week 5)
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    PRIMARY KEY (mmsi, msgtime)  -- natural key; also dedups reconnect replays
);

SELECT create_hypertable('ais_positions', 'msgtime');

CREATE INDEX idx_ais_positions_geom ON ais_positions USING GIST (geom);

-- Downsampling: 5-minute track points per vessel, kept 1 year.
CREATE MATERIALIZED VIEW ais_positions_5min
WITH (timescaledb.continuous) AS
SELECT
    mmsi,
    time_bucket('5 minutes', msgtime) AS bucket,
    last(latitude, msgtime)  AS latitude,   -- last known position in bucket
    last(longitude, msgtime) AS longitude,
    avg(sog)                 AS avg_sog,
    count(*)                 AS sample_count
FROM ais_positions
GROUP BY mmsi, bucket
WITH NO DATA;

-- Refresh job: materialize data between 3 days and 10 minutes old, every 30 min.
SELECT add_continuous_aggregate_policy('ais_positions_5min',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '30 minutes');

-- Retention: raw 30 days, downsampled 365 days.
SELECT add_retention_policy('ais_positions', drop_after => INTERVAL '30 days');
SELECT add_retention_policy('ais_positions_5min', drop_after => INTERVAL '365 days');

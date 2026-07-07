-- AIS position time series + vessel metadata.
-- Runs on first init of an empty volume (dev). Proper migration
-- tooling (Flyway) arrives with the Spring Boot API in week 3-4.

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
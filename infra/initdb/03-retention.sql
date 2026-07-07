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
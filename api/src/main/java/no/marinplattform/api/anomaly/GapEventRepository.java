package no.marinplattform.api.anomaly;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * Plain JdbcTemplate over gap_events + ais_positions + localities, same
 * rationale as the other repositories (decision log 2026-07-09): the PostGIS
 * geography predicates and the hypertable-aware time filtering are clearer as
 * hand-written SQL than through an ORM.
 */
@Repository
public class GapEventRepository {

    private static final RowMapper<GapEvent> GAP_MAPPER = GapEventRepository::mapGap;

    /**
     * Detect gaps and persist new ones in a single statement.
     *
     * <p>Rule ("going dark near a locality"): a vessel's most recent position
     * within {@code radiusMeters} of a locality is older than
     * {@code gapThresholdMinutes}, that last sighting is still within
     * {@code lookbackHours} (recently active, not ancient history), and the
     * vessel has <em>no</em> newer position anywhere — the {@code NOT EXISTS}
     * is what separates "went dark" from "sailed out of the radius".
     *
     * <p>{@code last_near} is time-bounded first (chunk exclusion on the
     * ais_positions hypertable) and the {@code ST_DWithin} predicate uses the
     * GiST indexes on both geography columns, same as the #12 radius query.
     *
     * <p>Dedup is the natural primary key: an ongoing gap keeps producing the
     * same {@code (mmsi, locality_no, last_seen_at)}, so {@code ON CONFLICT DO
     * NOTHING} means re-runs never re-emit it.
     *
     * @return number of newly inserted gap rows (0 if nothing new)
     */
    private static final String DETECT_AND_STORE_SQL = """
        INSERT INTO gap_events (
            mmsi, locality_no, last_seen_at, last_latitude, last_longitude, min_distance_m
        )
        WITH last_near AS (
            SELECT p.mmsi,
                   l.locality_no,
                   MAX(p.msgtime) AS last_seen_near
            FROM localities l
            JOIN ais_positions p
              ON p.msgtime >= now() - make_interval(hours => ?)   -- lookbackHours
             AND ST_DWithin(p.geom, l.geom, ?)                    -- radiusMeters
            GROUP BY p.mmsi, l.locality_no
        )
        SELECT ln.mmsi,
               ln.locality_no,
               ln.last_seen_near,
               last.latitude,
               last.longitude,
               ST_Distance(last.geom, l.geom) AS min_distance_m
        FROM last_near ln
        JOIN localities l
          ON l.locality_no = ln.locality_no
        JOIN ais_positions last
          ON last.mmsi = ln.mmsi
         AND last.msgtime = ln.last_seen_near
        WHERE ln.last_seen_near < now() - make_interval(mins => ?)  -- gapThresholdMinutes
          AND NOT EXISTS (
              SELECT 1
              FROM ais_positions p2
              WHERE p2.mmsi = ln.mmsi
                AND p2.msgtime > ln.last_seen_near
          )
        ON CONFLICT (mmsi, locality_no, last_seen_at) DO NOTHING
        """;

    private final JdbcTemplate jdbcTemplate;

    public GapEventRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int detectAndStoreGaps(int gapThresholdMinutes, int lookbackHours, double radiusMeters) {
        return jdbcTemplate.update(DETECT_AND_STORE_SQL, lookbackHours, radiusMeters, gapThresholdMinutes);
    }

    /** Most recently detected gaps first — for the integration test and future alerting/UI. */
    public List<GapEvent> findRecent(int limit) {
        return jdbcTemplate.query(
            """
            SELECT mmsi, locality_no, last_seen_at, last_latitude, last_longitude,
                   min_distance_m, detected_at
            FROM gap_events
            ORDER BY detected_at DESC
            LIMIT ?
            """,
            GAP_MAPPER,
            limit
        );
    }

    private static GapEvent mapGap(ResultSet rs, int rowNum) throws SQLException {
        return new GapEvent(
            rs.getInt("mmsi"),
            rs.getInt("locality_no"),
            rs.getTimestamp("last_seen_at").toInstant(),
            rs.getDouble("last_latitude"),
            rs.getDouble("last_longitude"),
            rs.getDouble("min_distance_m"),
            rs.getTimestamp("detected_at").toInstant()
        );
    }
}

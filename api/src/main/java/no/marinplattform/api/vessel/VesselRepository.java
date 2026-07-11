package no.marinplattform.api.vessel;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Plain JdbcTemplate over ais_positions/vessels rather than JPA: the
 * PostGIS geography column and Timescale-specific queries (chunk exclusion,
 * continuous aggregates) are easier to reason about as hand-written SQL
 * than through Hibernate Spatial. See decision log 2026-07-09.
 */
@Repository
public class VesselRepository {

    // Safety cap on findPositionsSince: bounds how much backlog a single
    // poll can pull if the broadcaster (#8) was stalled for a while.
    private static final int MAX_SINCE_BATCH = 5_000;

    private static final RowMapper<VesselDto> VESSEL_MAPPER = VesselRepository::mapVessel;
    private static final RowMapper<PositionDto> POSITION_MAPPER = VesselRepository::mapPosition;

    private final JdbcTemplate jdbcTemplate;

    public VesselRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<VesselDto> findAllVessels() {
        return jdbcTemplate.query(
            "SELECT mmsi, name, ship_type, last_seen FROM vessels ORDER BY last_seen DESC",
            VESSEL_MAPPER
        );
    }

    public List<PositionDto> findTrack(int mmsi, Instant from, Instant to, int limit) {
        return jdbcTemplate.query(
            """
            SELECT mmsi, msgtime, latitude, longitude, sog, cog
            FROM ais_positions
            WHERE mmsi = ? AND msgtime BETWEEN ? AND ?
            ORDER BY msgtime DESC
            LIMIT ?
            """,
            POSITION_MAPPER,
            mmsi, Timestamp.from(from), Timestamp.from(to), limit
        );
    }

    /**
     * Most recent position per vessel, bounded by {@code lookback} so the
     * query only touches the newest hypertable chunk(s) instead of scanning
     * the full 30-day retention window.
     */
    public List<PositionDto> findLatestPositions(Duration lookback) {
        return jdbcTemplate.query(
            """
            SELECT DISTINCT ON (mmsi) mmsi, msgtime, latitude, longitude, sog, cog
            FROM ais_positions
            WHERE msgtime > ?
            ORDER BY mmsi, msgtime DESC
            """,
            POSITION_MAPPER,
            Timestamp.from(Instant.now().minus(lookback))
        );
    }

    /**
     * Rows strictly newer than {@code since}, oldest-first, so a caller can
     * track its watermark from the last element. Backs the WebSocket
     * position broadcaster (#8), which polls this on a short interval
     * instead of the API subscribing to ingest directly — keeps ingest and
     * API decoupled, sharing only the database, per the brief's
     * architecture. Bounded by {@link #MAX_SINCE_BATCH}.
     */
    public List<PositionDto> findPositionsSince(Instant since) {
        return jdbcTemplate.query(
            """
            SELECT mmsi, msgtime, latitude, longitude, sog, cog
            FROM ais_positions
            WHERE msgtime > ?
            ORDER BY msgtime ASC
            LIMIT ?
            """,
            POSITION_MAPPER,
            Timestamp.from(since), MAX_SINCE_BATCH
        );
    }

    private static VesselDto mapVessel(ResultSet rs, int rowNum) throws SQLException {
        return new VesselDto(
            rs.getInt("mmsi"),
            rs.getString("name"),
            rs.getObject("ship_type", Short.class),
            rs.getTimestamp("last_seen").toInstant()
        );
    }

    private static PositionDto mapPosition(ResultSet rs, int rowNum) throws SQLException {
        return new PositionDto(
            rs.getInt("mmsi"),
            rs.getTimestamp("msgtime").toInstant(),
            rs.getDouble("latitude"),
            rs.getDouble("longitude"),
            rs.getObject("sog", Float.class),
            rs.getObject("cog", Float.class)
        );
    }
}

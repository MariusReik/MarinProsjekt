package no.marinplattform.api.locality;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * Plain JdbcTemplate over localities + ais_positions, same rationale as
 * {@code VesselRepository} (decision log 2026-07-09): the PostGIS geography
 * columns and the ST_DWithin radius query are clearer as hand-written SQL than
 * through Hibernate Spatial.
 */
@Repository
public class LocalityRepository {

    private static final RowMapper<LocalityDto> LOCALITY_MAPPER = LocalityRepository::mapLocality;
    private static final RowMapper<NearbyVesselDto> NEARBY_MAPPER = LocalityRepository::mapNearby;

    private final JdbcTemplate jdbcTemplate;

    public LocalityRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<LocalityDto> findAllLocalities() {
        return jdbcTemplate.query(
            "SELECT locality_no, name, latitude, longitude FROM localities ORDER BY name",
            LOCALITY_MAPPER
        );
    }

    public boolean localityExists(int localityNo) {
        Boolean exists = jdbcTemplate.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM localities WHERE locality_no = ?)",
            Boolean.class,
            localityNo
        );
        return Boolean.TRUE.equals(exists);
    }

    /**
     * Vessels whose AIS positions came within {@code radiusMeters} of the
     * locality between {@code from} and {@code to}, aggregated per MMSI.
     *
     * <p>The join is time-bounded first (chunk exclusion on the hypertable),
     * and the {@code ST_DWithin} predicate on the geography columns uses the
     * GiST index on both {@code ais_positions.geom} and {@code localities.geom}.
     * Distance is measured in meters because both columns are GEOGRAPHY(4326).
     */
    public List<NearbyVesselDto> findVesselsNearLocality(
        int localityNo, double radiusMeters, Instant from, Instant to
    ) {
        return jdbcTemplate.query(
            """
            SELECT p.mmsi,
                   v.name,
                   v.ship_type,
                   COUNT(*)              AS position_count,
                   MIN(p.msgtime)        AS first_seen,
                   MAX(p.msgtime)        AS last_seen,
                   MIN(ST_Distance(p.geom, l.geom)) AS min_distance_m
            FROM localities l
            JOIN ais_positions p
              ON p.msgtime BETWEEN ? AND ?
             AND ST_DWithin(p.geom, l.geom, ?)
            LEFT JOIN vessels v ON v.mmsi = p.mmsi
            WHERE l.locality_no = ?
            GROUP BY p.mmsi, v.name, v.ship_type
            ORDER BY last_seen DESC
            """,
            NEARBY_MAPPER,
            Timestamp.from(from), Timestamp.from(to), radiusMeters, localityNo
        );
    }

    private static LocalityDto mapLocality(ResultSet rs, int rowNum) throws SQLException {
        return new LocalityDto(
            rs.getInt("locality_no"),
            rs.getString("name"),
            rs.getDouble("latitude"),
            rs.getDouble("longitude")
        );
    }

    private static NearbyVesselDto mapNearby(ResultSet rs, int rowNum) throws SQLException {
        return new NearbyVesselDto(
            rs.getInt("mmsi"),
            rs.getString("name"),
            rs.getObject("ship_type", Short.class),
            rs.getLong("position_count"),
            rs.getTimestamp("first_seen").toInstant(),
            rs.getTimestamp("last_seen").toInstant(),
            rs.getDouble("min_distance_m")
        );
    }
}

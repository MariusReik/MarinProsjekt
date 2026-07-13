package no.marinplattform.api.locality;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the real PostGIS ST_DWithin radius query against a live Postgres
 * (same rationale/setup as VesselRepositoryIntegrationTest). Requires the
 * localities table from infra/initdb/04-localities.sql (issue #11).
 *
 * Named *Test, not *IT, so Surefire's "mvn test" actually runs it.
 */
@SpringBootTest
class LocalityRepositoryIntegrationTest {

    private static final int TEST_LOCALITY_NO = 999_999_801;
    private static final int NEAR_MMSI = 999_999_811;
    private static final int FAR_MMSI = 999_999_812;

    // Locality centre; ~0.001° latitude ≈ 111 m, so offsets below are well
    // inside / outside a 1 km radius.
    private static final double LOC_LAT = 60.40;
    private static final double LOC_LON = 5.32;

    @Autowired
    private LocalityRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM ais_positions WHERE mmsi IN (?, ?)", NEAR_MMSI, FAR_MMSI);
        jdbcTemplate.update("DELETE FROM vessels WHERE mmsi IN (?, ?)", NEAR_MMSI, FAR_MMSI);
        jdbcTemplate.update("DELETE FROM localities WHERE locality_no = ?", TEST_LOCALITY_NO);
    }

    @Test
    void findsOnlyVesselsWithinRadiusAndAggregatesPerVessel() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertLocality();
        insertVessel(NEAR_MMSI, "Near Vessel");
        insertVessel(FAR_MMSI, "Far Vessel");

        // Near vessel: two positions ~111 m and ~222 m north — both inside 1 km.
        insertPosition(NEAR_MMSI, now.minus(Duration.ofHours(2)), LOC_LAT + 0.001, LOC_LON);
        insertPosition(NEAR_MMSI, now.minus(Duration.ofHours(1)), LOC_LAT + 0.002, LOC_LON);
        // Far vessel: ~5.5 km north — outside 1 km.
        insertPosition(FAR_MMSI, now.minus(Duration.ofHours(1)), LOC_LAT + 0.05, LOC_LON);

        List<NearbyVesselDto> nearby = repository.findVesselsNearLocality(
            TEST_LOCALITY_NO, 1_000, now.minus(Duration.ofDays(7)), now
        );

        assertEquals(1, nearby.size());
        NearbyVesselDto near = nearby.get(0);
        assertEquals(NEAR_MMSI, near.mmsi());
        assertEquals("Near Vessel", near.name());
        assertEquals(2, near.positionCount());
        assertTrue(near.minDistanceMeters() < 1_000,
            "closest approach should be within the radius, was " + near.minDistanceMeters());
    }

    @Test
    void localityExistsReflectsPresence() {
        assertTrue(!repository.localityExists(TEST_LOCALITY_NO));
        insertLocality();
        assertTrue(repository.localityExists(TEST_LOCALITY_NO));
    }

    private void insertLocality() {
        jdbcTemplate.update(
            "INSERT INTO localities (locality_no, name, latitude, longitude) VALUES (?, ?, ?, ?)",
            TEST_LOCALITY_NO, "Test Locality", LOC_LAT, LOC_LON
        );
    }

    private void insertVessel(int mmsi, String name) {
        jdbcTemplate.update(
            "INSERT INTO vessels (mmsi, name, ship_type, last_seen) VALUES (?, ?, ?, ?)",
            mmsi, name, (short) 70, Timestamp.from(Instant.now())
        );
    }

    private void insertPosition(int mmsi, Instant msgtime, double lat, double lon) {
        jdbcTemplate.update(
            "INSERT INTO ais_positions (mmsi, msgtime, latitude, longitude, sog, cog) VALUES (?, ?, ?, ?, ?, ?)",
            mmsi, Timestamp.from(msgtime), lat, lon, 5f, 90f
        );
    }
}

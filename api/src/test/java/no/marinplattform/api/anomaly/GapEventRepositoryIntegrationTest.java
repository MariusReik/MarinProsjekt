package no.marinplattform.api.anomaly;

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
 * Exercises the real "going dark near a locality" rule against a live Postgres
 * (same setup/rationale as LocalityRepositoryIntegrationTest, #12). Requires the
 * localities table (#11) and the gap_events table (Flyway V3).
 *
 * <p>Named *Test, not *IT, so Surefire's "mvn test" runs it.
 */
@SpringBootTest
class GapEventRepositoryIntegrationTest {

    private static final int TEST_LOCALITY_NO = 999_999_901;
    private static final int DARK_MMSI = 999_999_911;   // went dark near the locality
    private static final int SAILED_MMSI = 999_999_912;  // left the radius, still sending
    private static final int FRESH_MMSI = 999_999_913;   // near and recently seen

    // ~0.001° latitude ≈ 111 m, so the offsets below sit well inside a 1 km radius.
    private static final double LOC_LAT = 60.40;
    private static final double LOC_LON = 5.32;

    // Rule params under test.
    private static final int GAP_THRESHOLD_MIN = 30;
    private static final int LOOKBACK_HOURS = 12;
    private static final double RADIUS_M = 1_000;

    @Autowired
    private GapEventRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        int[] mmsis = {DARK_MMSI, SAILED_MMSI, FRESH_MMSI};
        for (int mmsi : mmsis) {
            jdbcTemplate.update("DELETE FROM gap_events WHERE mmsi = ?", mmsi);
            jdbcTemplate.update("DELETE FROM ais_positions WHERE mmsi = ?", mmsi);
            jdbcTemplate.update("DELETE FROM vessels WHERE mmsi = ?", mmsi);
        }
        jdbcTemplate.update("DELETE FROM localities WHERE locality_no = ?", TEST_LOCALITY_NO);
    }

    @Test
    void recordsAGapForAVesselThatWentDarkNearTheLocality() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertLocality();

        // Dark vessel: last seen 2 h ago right next to the locality, nothing since.
        insertVessel(DARK_MMSI);
        insertPosition(DARK_MMSI, now.minus(Duration.ofHours(3)), LOC_LAT + 0.001, LOC_LON);
        insertPosition(DARK_MMSI, now.minus(Duration.ofHours(2)), LOC_LAT + 0.001, LOC_LON);

        int inserted = repository.detectAndStoreGaps(GAP_THRESHOLD_MIN, LOOKBACK_HOURS, RADIUS_M);

        assertEquals(1, inserted);
        List<GapEvent> gaps = repository.findRecent(10);
        assertEquals(1, gaps.size());
        GapEvent gap = gaps.get(0);
        assertEquals(DARK_MMSI, gap.mmsi());
        assertEquals(TEST_LOCALITY_NO, gap.localityNo());
        assertEquals(now.minus(Duration.ofHours(2)), gap.lastSeenAt());
        assertTrue(gap.minDistanceMeters() < RADIUS_M,
            "closest approach should be within the radius, was " + gap.minDistanceMeters());
    }

    @Test
    void ignoresAVesselThatSailedAwayButKeepsSending() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertLocality();

        // Near the locality 2 h ago, then a fresh position ~5.5 km away 5 min ago:
        // it left the radius but is NOT dark, so it must not be flagged.
        insertVessel(SAILED_MMSI);
        insertPosition(SAILED_MMSI, now.minus(Duration.ofHours(2)), LOC_LAT + 0.001, LOC_LON);
        insertPosition(SAILED_MMSI, now.minus(Duration.ofMinutes(5)), LOC_LAT + 0.05, LOC_LON);

        int inserted = repository.detectAndStoreGaps(GAP_THRESHOLD_MIN, LOOKBACK_HOURS, RADIUS_M);

        assertEquals(0, inserted);
        assertTrue(repository.findRecent(10).isEmpty());
    }

    @Test
    void ignoresAVesselStillActivelySendingNearTheLocality() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertLocality();

        // Last seen 5 min ago — inside the threshold, not a gap yet.
        insertVessel(FRESH_MMSI);
        insertPosition(FRESH_MMSI, now.minus(Duration.ofMinutes(5)), LOC_LAT + 0.001, LOC_LON);

        int inserted = repository.detectAndStoreGaps(GAP_THRESHOLD_MIN, LOOKBACK_HOURS, RADIUS_M);

        assertEquals(0, inserted);
    }

    @Test
    void isIdempotentForAnOngoingGap() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertLocality();
        insertVessel(DARK_MMSI);
        insertPosition(DARK_MMSI, now.minus(Duration.ofHours(2)), LOC_LAT + 0.001, LOC_LON);

        assertEquals(1, repository.detectAndStoreGaps(GAP_THRESHOLD_MIN, LOOKBACK_HOURS, RADIUS_M));
        // Second run: same (mmsi, locality_no, last_seen_at) — ON CONFLICT DO NOTHING.
        assertEquals(0, repository.detectAndStoreGaps(GAP_THRESHOLD_MIN, LOOKBACK_HOURS, RADIUS_M));
        assertEquals(1, repository.findRecent(10).size());
    }

    private void insertLocality() {
        jdbcTemplate.update(
            "INSERT INTO localities (locality_no, name, latitude, longitude) VALUES (?, ?, ?, ?)",
            TEST_LOCALITY_NO, "Test Locality", LOC_LAT, LOC_LON
        );
    }

    private void insertVessel(int mmsi) {
        jdbcTemplate.update(
            "INSERT INTO vessels (mmsi, name, ship_type, last_seen) VALUES (?, ?, ?, ?)",
            mmsi, "Test Vessel " + mmsi, (short) 70, Timestamp.from(Instant.now())
        );
    }

    private void insertPosition(int mmsi, Instant msgtime, double lat, double lon) {
        jdbcTemplate.update(
            "INSERT INTO ais_positions (mmsi, msgtime, latitude, longitude, sog, cog) VALUES (?, ?, ?, ?, ?, ?)",
            mmsi, Timestamp.from(msgtime), lat, lon, 0f, 0f
        );
    }
}

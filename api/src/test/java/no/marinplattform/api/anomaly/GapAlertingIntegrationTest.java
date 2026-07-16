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
 * Exercises the alerting queries (issue #15) against a live Postgres: which gaps
 * are pending, and that stamping one is a one-shot. Same isolation approach as
 * {@link GapEventRepositoryIntegrationTest} — wipe the 999_999_xxx test range so
 * fixtures left by other tests can't leak in (see [[ci-integration-test-isolation]]).
 */
@SpringBootTest
class GapAlertingIntegrationTest {

    private static final int TEST_FLOOR = 999_000_000;
    private static final int LOCALITY_NO = 999_999_950;
    private static final int MMSI_OLDER = 999_999_961;
    private static final int MMSI_NEWER = 999_999_962;
    private static final int MMSI_ALERTED = 999_999_963;

    @Autowired
    private GapEventRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        // gap_events first — FK to localities.
        jdbcTemplate.update("DELETE FROM gap_events WHERE locality_no >= ?", TEST_FLOOR);
        jdbcTemplate.update("DELETE FROM localities WHERE locality_no >= ?", TEST_FLOOR);
    }

    @Test
    void findUnalertedReturnsOnlyPendingGapsOldestFirst() {
        insertLocality();
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertGap(MMSI_OLDER, lastSeen(now), now.minus(Duration.ofMinutes(10)), null);
        insertGap(MMSI_NEWER, lastSeen(now), now.minus(Duration.ofMinutes(5)), null);
        // Already delivered — must be excluded.
        insertGap(MMSI_ALERTED, lastSeen(now), now.minus(Duration.ofMinutes(1)), now);

        List<GapEvent> pending = repository.findUnalerted(10);

        assertEquals(2, pending.size());
        assertEquals(MMSI_OLDER, pending.get(0).mmsi(), "oldest detected_at should come first");
        assertEquals(MMSI_NEWER, pending.get(1).mmsi());
    }

    @Test
    void markAlertedStampsOnceAndIsIdempotent() {
        insertLocality();
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant seen = lastSeen(now);
        insertGap(MMSI_OLDER, seen, now.minus(Duration.ofMinutes(5)), null);

        assertEquals(1, repository.markAlerted(MMSI_OLDER, LOCALITY_NO, seen),
            "first delivery should stamp the row");
        assertEquals(0, repository.markAlerted(MMSI_OLDER, LOCALITY_NO, seen),
            "an already-alerted gap must not be stamped again");
        assertTrue(repository.findUnalerted(10).isEmpty(),
            "a stamped gap should no longer be pending");
    }

    private static Instant lastSeen(Instant now) {
        return now.minus(Duration.ofHours(2));
    }

    private void insertLocality() {
        jdbcTemplate.update(
            "INSERT INTO localities (locality_no, name, latitude, longitude) VALUES (?, ?, ?, ?)",
            LOCALITY_NO, "Test Locality", 60.40, 5.32
        );
    }

    private void insertGap(int mmsi, Instant lastSeenAt, Instant detectedAt, Instant alertedAt) {
        jdbcTemplate.update(
            """
            INSERT INTO gap_events (
                mmsi, locality_no, last_seen_at, last_latitude, last_longitude,
                min_distance_m, detected_at, alerted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            mmsi, LOCALITY_NO, Timestamp.from(lastSeenAt), 60.41, 5.32, 250.0,
            Timestamp.from(detectedAt), alertedAt == null ? null : Timestamp.from(alertedAt)
        );
    }
}

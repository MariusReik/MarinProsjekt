package no.marinplattform.api.vessel;

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
 * Exercises the real SQL (incl. the PostGIS/Timescale-backed table) against
 * a live Postgres instance rather than mocking JdbcTemplate — that's the
 * whole point of choosing hand-written SQL over JPA here.
 *
 * Requires a reachable Postgres: docker compose -f infra/docker-compose.yml
 * up -d postgres (already true for local dev; CI provides its own service
 * container).
 *
 * Named *Test, not *IT: no Failsafe plugin is configured, so "mvn test"
 * only picks up Surefire's default patterns (*Test/*Tests). An *IT suffix
 * would silently never run.
 */
@SpringBootTest
class VesselRepositoryIntegrationTest {

    private static final int TEST_MMSI = 999_999_901;

    @Autowired
    private VesselRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUpTestVessel() {
        jdbcTemplate.update("DELETE FROM ais_positions WHERE mmsi = ?", TEST_MMSI);
        jdbcTemplate.update("DELETE FROM vessels WHERE mmsi = ?", TEST_MMSI);
    }

    @Test
    void findsVesselAndItsTrack() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        jdbcTemplate.update(
            "INSERT INTO vessels (mmsi, name, ship_type, last_seen) VALUES (?, ?, ?, ?)",
            TEST_MMSI, "Test Vessel", (short) 70, Timestamp.from(now)
        );
        jdbcTemplate.update(
            "INSERT INTO ais_positions (mmsi, msgtime, latitude, longitude, sog, cog) VALUES (?, ?, ?, ?, ?, ?)",
            TEST_MMSI, Timestamp.from(now), 60.39, 5.32, 8.5f, 90f
        );

        List<VesselDto> vessels = repository.findAllVessels();
        assertTrue(vessels.stream().anyMatch(v -> v.mmsi() == TEST_MMSI));

        List<PositionDto> track = repository.findTrack(
            TEST_MMSI, now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(1)), 10
        );
        assertEquals(1, track.size());
        assertEquals(TEST_MMSI, track.get(0).mmsi());

        List<PositionDto> latest = repository.findLatestPositions(Duration.ofMinutes(5));
        assertTrue(latest.stream().anyMatch(p -> p.mmsi() == TEST_MMSI));
    }
}

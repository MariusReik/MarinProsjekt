package no.marinplattform.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Smoke test for the skeleton: verifies the Spring context starts, the
 * datasource connects, and Flyway migrations apply cleanly.
 *
 * Requires a reachable Postgres instance — start it first with:
 *   docker compose -f infra/docker-compose.yml up -d postgres
 */
@SpringBootTest
class ApiApplicationTests {

    @Test
    void contextLoads() {
        // Intentionally empty: a failing context load (bad datasource config,
        // failed Flyway migration, etc.) fails this test on its own.
    }
}

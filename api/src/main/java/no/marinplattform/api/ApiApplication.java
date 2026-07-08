package no.marinplattform.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the marine platform API.
 *
 * This is intentionally a bare skeleton (issue #6): boots the app, connects
 * to Postgres, and applies Flyway migrations. REST endpoints land in #7,
 * the WebSocket position feed in #8.
 */
@SpringBootApplication
public class ApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiApplication.class, args);
    }
}

package no.marinplattform.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the marine platform API.
 *
 * Boots the app, connects to Postgres, and applies Flyway migrations. REST
 * endpoints landed in #7. @EnableScheduling drives the WebSocket position
 * broadcaster from #8 (no separate scheduling config needed for one task).
 */
@SpringBootApplication
@EnableScheduling
public class ApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiApplication.class, args);
    }
}

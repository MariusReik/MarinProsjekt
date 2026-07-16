package no.marinplattform.api.anomaly;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background anomaly job: the AIS-gap detection rule from the brief's week-6
 * milestone (§7) and v1 DoD (§4). Periodically finds vessels that were active
 * near a locality and then "went dark", and persists each as a gap_event.
 *
 * <p>Runs in the API (rather than a separate service) because it only needs the
 * shared database — same reasoning as the #8 broadcaster — and reuses Spring's
 * scheduler already enabled by {@code @EnableScheduling}.
 *
 * <p>Like {@code PositionBroadcastService} (#8), any failure is caught and
 * logged rather than propagated: an uncaught exception out of a
 * {@code fixedDelay} scheduled method cancels all future executions, which
 * would silently stop anomaly detection until the next restart.
 *
 * <p>Detection and dedup happen in one SQL statement in the repository; this
 * class owns the schedule, configuration, and error boundary. Alerting on new
 * gaps (email/webhook) is a separate follow-up issue (week 6, step 2).
 */
@Component
@EnableConfigurationProperties(GapDetectionProperties.class)
public class GapDetectionService {

    private static final Logger log = LoggerFactory.getLogger(GapDetectionService.class);

    private final GapEventRepository repository;
    private final GapDetectionProperties properties;

    public GapDetectionService(GapEventRepository repository, GapDetectionProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${app.anomaly.gap-check-interval-ms:60000}")
    public void detectGaps() {
        try {
            int inserted = repository.detectAndStoreGaps(
                properties.gapThresholdMinutes(),
                properties.lookbackHours(),
                properties.radiusMeters()
            );
            if (inserted > 0) {
                log.info("AIS gap detection: recorded {} new gap event(s)", inserted);
            }
        } catch (Exception ex) {
            // Swallow so a transient DB error doesn't cancel the schedule.
            log.error("AIS gap detection cycle failed", ex);
        }
    }
}

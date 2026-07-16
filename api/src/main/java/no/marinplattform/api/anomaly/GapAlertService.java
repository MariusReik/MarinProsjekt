package no.marinplattform.api.anomaly;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Delivers alerts for detected AIS gaps (issue #15), completing the week-6
 * milestone (§7) and v1 DoD (§4): "one anomaly rule in production with
 * email/webhook alerting".
 *
 * <p>Runs as its own scheduled job that polls {@code gap_events} for rows not
 * yet alerted ({@code alerted_at IS NULL}) — decoupled from detection, and the
 * poll-and-stamp pattern gives retries for free: a failed delivery leaves the
 * row unmarked, so the next cycle picks it up again. Same rationale as the #8
 * broadcaster (services share only the database).
 *
 * <p>Dedup is the {@code alerted_at} marker: each gap is stamped after its first
 * successful delivery and then never re-selected. Delivery outcomes are logged
 * per gap.
 *
 * <p>Error handling mirrors the other scheduled jobs: a per-gap failure is
 * logged and skipped (the batch continues, that gap retries next cycle), and
 * the whole cycle is wrapped so an unexpected error can't cancel the schedule.
 */
@Component
@EnableConfigurationProperties(GapAlertProperties.class)
public class GapAlertService {

    private static final Logger log = LoggerFactory.getLogger(GapAlertService.class);

    private final GapEventRepository repository;
    private final GapAlertNotifier notifier;
    private final GapAlertProperties properties;

    public GapAlertService(
        GapEventRepository repository,
        GapAlertNotifier notifier,
        GapAlertProperties properties
    ) {
        this.repository = repository;
        this.notifier = notifier;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${app.alerting.check-interval-ms:60000}")
    public void deliverPendingAlerts() {
        if (!properties.enabled()) {
            return; // no webhook configured — alerting is off
        }
        try {
            List<GapEvent> pending = repository.findUnalerted(properties.batchLimit());
            int delivered = 0;
            for (GapEvent gap : pending) {
                if (deliver(gap)) {
                    delivered++;
                }
            }
            if (delivered > 0) {
                log.info("Delivered {} of {} pending gap alert(s)", delivered, pending.size());
            }
        } catch (Exception ex) {
            // Swallow so a transient DB/query error doesn't cancel the schedule.
            log.error("Gap alert cycle failed", ex);
        }
    }

    /** Deliver one gap and stamp it; returns true only on a successful delivery. */
    private boolean deliver(GapEvent gap) {
        try {
            notifier.send(gap);
            repository.markAlerted(gap.mmsi(), gap.localityNo(), gap.lastSeenAt());
            log.info(
                "Gap alert delivered via webhook: mmsi={} locality={} lastSeen={}",
                gap.mmsi(), gap.localityNo(), gap.lastSeenAt()
            );
            return true;
        } catch (Exception ex) {
            // Leave alerted_at NULL so the next cycle retries this gap.
            log.error(
                "Gap alert delivery failed (will retry): mmsi={} locality={}",
                gap.mmsi(), gap.localityNo(), ex
            );
            return false;
        }
    }
}

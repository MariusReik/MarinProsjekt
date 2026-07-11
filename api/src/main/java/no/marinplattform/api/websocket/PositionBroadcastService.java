package no.marinplattform.api.websocket;

import no.marinplattform.api.vessel.PositionDto;
import no.marinplattform.api.vessel.VesselRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Polls {@code ais_positions} for rows newer than the last broadcast and
 * pushes them to {@value #POSITIONS_TOPIC} (issue #8).
 *
 * Polling the database rather than wiring the API to ingest directly (DB
 * LISTEN/NOTIFY, a message broker, ...) keeps the two services decoupled —
 * they only share Postgres, matching the brief's architecture diagram. It's
 * also the smallest step that gets live updates onto the wire.
 *
 * Any failure (e.g. a transient DB hiccup) is caught and logged rather than
 * propagated: an uncaught exception from a {@code fixedDelay} scheduled
 * method cancels all future executions, which would silently kill the live
 * feed until the next restart.
 */
@Component
public class PositionBroadcastService {

    public static final String POSITIONS_TOPIC = "/topic/positions";

    private static final Logger log = LoggerFactory.getLogger(PositionBroadcastService.class);

    private final VesselRepository repository;
    private final SimpMessagingTemplate messagingTemplate;

    // Starts at "now" so a fresh deploy doesn't replay the retention
    // window's worth of history to the first connected client.
    private final AtomicReference<Instant> lastBroadcastAt = new AtomicReference<>(Instant.now());

    public PositionBroadcastService(VesselRepository repository, SimpMessagingTemplate messagingTemplate) {
        this.repository = repository;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedDelayString = "${app.websocket.broadcast-interval-ms:2000}")
    public void broadcastNewPositions() {
        Instant since = lastBroadcastAt.get();
        try {
            List<PositionDto> positions = repository.findPositionsSince(since);
            if (positions.isEmpty()) {
                return;
            }

            messagingTemplate.convertAndSend(POSITIONS_TOPIC, positions);

            positions.stream()
                .map(PositionDto::msgtime)
                .max(Comparator.naturalOrder())
                .ifPresent(lastBroadcastAt::set);
        } catch (Exception ex) {
            log.error("Failed to broadcast positions since {}", since, ex);
        }
    }
}

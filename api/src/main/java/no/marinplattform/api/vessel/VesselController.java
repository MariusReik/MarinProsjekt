package no.marinplattform.api.vessel;

import no.marinplattform.api.error.InvalidQueryException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Historical/lookup queries only. Live updates go out over WebSocket
 * instead (see {@code websocket.PositionBroadcastService}, issue #8);
 * POI/radius queries land in week 5 alongside aquaculture sites.
 */
@RestController
@RequestMapping("/api")
public class VesselController {

    private static final int DEFAULT_TRACK_LIMIT = 1_000;
    private static final int MAX_TRACK_LIMIT = 10_000;
    private static final int DEFAULT_LATEST_LOOKBACK_MINUTES = 15;
    private static final int MAX_LATEST_LOOKBACK_MINUTES = 60;

    private final VesselRepository repository;

    public VesselController(VesselRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/vessels")
    public List<VesselDto> vessels() {
        return repository.findAllVessels();
    }

    @GetMapping("/vessels/{mmsi}/track")
    public List<PositionDto> track(
        @PathVariable int mmsi,
        @RequestParam(required = false) Instant from,
        @RequestParam(required = false) Instant to,
        @RequestParam(required = false) Integer limit
    ) {
        Instant effectiveTo = to != null ? to : Instant.now();
        Instant effectiveFrom = from != null ? from : effectiveTo.minus(Duration.ofHours(24));

        if (effectiveFrom.isAfter(effectiveTo)) {
            throw new InvalidQueryException("'from' must not be after 'to'");
        }

        int effectiveLimit = clamp(limit != null ? limit : DEFAULT_TRACK_LIMIT, 1, MAX_TRACK_LIMIT);

        return repository.findTrack(mmsi, effectiveFrom, effectiveTo, effectiveLimit);
    }

    @GetMapping("/positions/latest")
    public List<PositionDto> latest(@RequestParam(required = false) Integer sinceMinutes) {
        int minutes = clamp(
            sinceMinutes != null ? sinceMinutes : DEFAULT_LATEST_LOOKBACK_MINUTES,
            1, MAX_LATEST_LOOKBACK_MINUTES
        );
        return repository.findLatestPositions(Duration.ofMinutes(minutes));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}

package no.marinplattform.api.locality;

import no.marinplattform.api.error.ResourceNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Aquaculture localities as points of interest, and the core "vessels within
 * radius of a locality" activity query (issue #12, brief user story #1). The
 * radius query is the contextualisation the brief centres on: vessel activity
 * interpreted relative to the user's own locations.
 */
@RestController
@RequestMapping("/api/localities")
public class LocalityController {

    // Brief default: 1 km radius, 7-day window. Clamped, not rejected, so a
    // wild query param degrades to a sane bound instead of a 400.
    private static final double DEFAULT_RADIUS_METERS = 1_000;
    private static final double MIN_RADIUS_METERS = 50;
    private static final double MAX_RADIUS_METERS = 50_000;
    private static final int DEFAULT_WINDOW_HOURS = 24 * 7;
    private static final int MIN_WINDOW_HOURS = 1;
    // 30 days matches the raw ais_positions retention (decision log 2026-07-07);
    // querying further back would only ever hit downsampled data.
    private static final int MAX_WINDOW_HOURS = 24 * 30;

    private final LocalityRepository repository;

    public LocalityController(LocalityRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<LocalityDto> localities() {
        return repository.findAllLocalities();
    }

    @GetMapping("/{localityNo}/vessels")
    public List<NearbyVesselDto> vesselsNear(
        @PathVariable int localityNo,
        @RequestParam(required = false) Double radiusMeters,
        @RequestParam(required = false) Integer hours
    ) {
        if (!repository.localityExists(localityNo)) {
            throw new ResourceNotFoundException("No locality with number " + localityNo);
        }

        double radius = clamp(
            radiusMeters != null ? radiusMeters : DEFAULT_RADIUS_METERS,
            MIN_RADIUS_METERS, MAX_RADIUS_METERS
        );
        int window = clamp(
            hours != null ? hours : DEFAULT_WINDOW_HOURS,
            MIN_WINDOW_HOURS, MAX_WINDOW_HOURS
        );

        Instant to = Instant.now();
        Instant from = to.minus(Duration.ofHours(window));
        return repository.findVesselsNearLocality(localityNo, radius, from, to);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}

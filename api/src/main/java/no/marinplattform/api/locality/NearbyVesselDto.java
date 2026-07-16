package no.marinplattform.api.locality;

import java.time.Instant;

/**
 * A vessel that was active within a given radius of a locality over a time
 * window (issue #12). Aggregated per MMSI from ais_positions:
 * {@code positionCount} messages between {@code firstSeen} and {@code lastSeen},
 * with {@code minDistanceMeters} the closest approach to the locality.
 */
public record NearbyVesselDto(
    int mmsi,
    String name,
    Short shipType,
    long positionCount,
    Instant firstSeen,
    Instant lastSeen,
    double minDistanceMeters
) {}

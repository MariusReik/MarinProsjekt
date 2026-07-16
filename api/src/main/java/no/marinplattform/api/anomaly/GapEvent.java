package no.marinplattform.api.anomaly;

import java.time.Instant;

/**
 * A detected AIS gap: vessel {@code mmsi} was active within radius of locality
 * {@code localityNo}, was last seen there at {@code lastSeenAt} (closest
 * approach {@code minDistanceMeters}), and then stopped sending AIS entirely
 * ("went dark near a site", brief §2/§19). {@code detectedAt} is when the
 * background job recorded it.
 */
public record GapEvent(
    int mmsi,
    int localityNo,
    Instant lastSeenAt,
    double lastLatitude,
    double lastLongitude,
    double minDistanceMeters,
    Instant detectedAt
) {}

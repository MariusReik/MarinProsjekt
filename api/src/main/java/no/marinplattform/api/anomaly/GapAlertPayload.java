package no.marinplattform.api.anomaly;

import java.time.Instant;

/**
 * Stable JSON body POSTed to the alert webhook (issue #15). Decoupled from the
 * internal {@link GapEvent} record so the wire format is an explicit contract:
 * {@code eventType} lets a receiver route future anomaly types, and the fields
 * describe which vessel went dark near which locality, when, and how close.
 */
public record GapAlertPayload(
    String eventType,
    int mmsi,
    int localityNo,
    Instant lastSeenAt,
    double lastLatitude,
    double lastLongitude,
    double minDistanceMeters,
    Instant detectedAt
) {
    public static final String EVENT_TYPE = "ais_gap";

    public static GapAlertPayload from(GapEvent gap) {
        return new GapAlertPayload(
            EVENT_TYPE,
            gap.mmsi(),
            gap.localityNo(),
            gap.lastSeenAt(),
            gap.lastLatitude(),
            gap.lastLongitude(),
            gap.minDistanceMeters(),
            gap.detectedAt()
        );
    }
}

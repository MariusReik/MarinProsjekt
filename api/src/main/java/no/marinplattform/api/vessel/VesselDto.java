package no.marinplattform.api.vessel;

import java.time.Instant;

public record VesselDto(
    int mmsi,
    String name,
    Short shipType,
    Instant lastSeen
) {}

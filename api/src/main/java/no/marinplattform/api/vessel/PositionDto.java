package no.marinplattform.api.vessel;

import java.time.Instant;

public record PositionDto(
    int mmsi,
    Instant msgtime,
    double latitude,
    double longitude,
    Float sog,
    Float cog
) {}

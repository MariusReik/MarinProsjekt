package no.marinplattform.api.locality;

/**
 * An aquaculture locality (Fiskehelse point of interest), ingested by the
 * ingest service (issue #11) and exposed here as a map layer / selectable POI
 * for the radius query (issue #12).
 */
public record LocalityDto(
    int localityNo,
    String name,
    double latitude,
    double longitude
) {}

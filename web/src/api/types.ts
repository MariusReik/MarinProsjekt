/**
 * Wire types mirroring the Spring Boot DTOs.
 *
 * - Position  -> no.marinplattform.api.vessel.PositionDto (issues #7/#8)
 * - Vessel    -> no.marinplattform.api.vessel.VesselDto   (issue #7)
 *
 * Jackson serialises Instant as ISO-8601 strings (Spring Boot disables
 * WRITE_DATES_AS_TIMESTAMPS by default), and Float/Short as JSON numbers that
 * may be null. Keep these in sync if the DTOs change.
 */

export interface Position {
  mmsi: number;
  msgtime: string; // ISO-8601 UTC
  latitude: number;
  longitude: number;
  sog: number | null; // speed over ground (knots)
  cog: number | null; // course over ground (degrees)
}

export interface Vessel {
  mmsi: number;
  name: string | null;
  shipType: number | null;
  lastSeen: string; // ISO-8601 UTC
}

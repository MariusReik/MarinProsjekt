import type { Locality, NearbyVessel, Position, Vessel } from "./types";
import { LATEST_SNAPSHOT_MINUTES } from "../config";

/**
 * Thin REST client for the Spring Boot API. All requests go to same-origin
 * "/api/..." paths, which the Vite dev proxy (and the production reverse proxy)
 * forwards to the API — see vite.config.ts.
 */

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    // Surface the API's ApiError body when present (error/ApiExceptionHandler).
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string };
      detail = body?.message ? `: ${body.message}` : "";
    } catch {
      // non-JSON error body; ignore
    }
    throw new Error(`${path} -> ${response.status} ${response.statusText}${detail}`);
  }
  return (await response.json()) as T;
}

/** Latest known position per vessel within the API's lookback window. */
export function fetchLatestPositions(signal?: AbortSignal): Promise<Position[]> {
  return getJson<Position[]>(`/api/positions/latest?sinceMinutes=${LATEST_SNAPSHOT_MINUTES}`, signal);
}

/** All known vessels; used to resolve MMSI -> name for the info panel. */
export function fetchVessels(signal?: AbortSignal): Promise<Vessel[]> {
  return getJson<Vessel[]>("/api/vessels", signal);
}

/**
 * Historical track for a single vessel over the last {@code lookbackHours}.
 * The API returns rows newest-first; callers that draw a line should reverse.
 */
export function fetchTrack(
  mmsi: number,
  lookbackHours: number,
  signal?: AbortSignal
): Promise<Position[]> {
  const to = new Date();
  const from = new Date(to.getTime() - lookbackHours * 60 * 60 * 1000);
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<Position[]>(`/api/vessels/${mmsi}/track?${params.toString()}`, signal);
}

/** All aquaculture localities; rendered as a map layer and selectable POIs. */
export function fetchLocalities(signal?: AbortSignal): Promise<Locality[]> {
  return getJson<Locality[]>("/api/localities", signal);
}

/**
 * Vessels active within {@code radiusMeters} of a locality over the last
 * {@code hours} — the PostGIS ST_DWithin activity query (issue #12).
 */
export function fetchNearbyVessels(
  localityNo: number,
  radiusMeters: number,
  hours: number,
  signal?: AbortSignal
): Promise<NearbyVessel[]> {
  const params = new URLSearchParams({
    radiusMeters: String(radiusMeters),
    hours: String(hours),
  });
  return getJson<NearbyVessel[]>(
    `/api/localities/${localityNo}/vessels?${params.toString()}`,
    signal
  );
}

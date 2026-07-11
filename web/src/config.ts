/**
 * Static configuration for the dashboard. Kept in one place so the map extent
 * stays in sync with the ingest geographic filter (brief §9, decision
 * 2026-07-07: Vestland box 59.0–62.5°N, 3.5–8.0°E).
 */

/** Initial map center [lng, lat] — roughly the middle of the Vestland box. */
export const MAP_CENTER: [number, number] = [5.75, 60.75];

export const MAP_INITIAL_ZOOM = 6.5;

/**
 * Bounding box the ingest service filters to. Used to fit/constrain the map so
 * the user starts looking at the area that actually has data.
 * [west, south, east, north]
 */
export const VESTLAND_BBOX: [number, number, number, number] = [3.5, 59.0, 8.0, 62.5];

/**
 * How often the map's vessel GeoJSON source is rebuilt from the in-memory
 * position store. Decoupling this from WebSocket message arrival keeps the
 * render cost bounded even under bursty broadcasts (~1200 vessels in the box).
 */
export const MAP_REFRESH_INTERVAL_MS = 1000;

/**
 * Vessels not updated within this window are dropped from the map. Longer than
 * a couple of broadcast intervals so a vessel doesn't flicker out between
 * messages, but short enough that stale/departed vessels disappear.
 */
export const VESSEL_STALE_AFTER_MS = 15 * 60 * 1000;

/** Default lookback for the initial REST snapshot (matches API default). */
export const LATEST_SNAPSHOT_MINUTES = 15;

/** How far back to fetch a vessel's historical track when clicked. */
export const TRACK_LOOKBACK_HOURS = 24;

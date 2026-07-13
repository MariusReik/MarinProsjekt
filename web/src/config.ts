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

/** A selectable look-back window for a vessel's historical track. */
export interface TrackWindow {
  /** Short label for the segmented time filter (issue #10). */
  label: string;
  /** How far back from "now" the track query should reach. */
  hours: number;
}

/**
 * Time-filter presets offered when a vessel is selected (issue #10). The API
 * caps a track at MAX_TRACK_LIMIT rows, so a 7 d window may be truncated for
 * busy vessels — the panel surfaces the returned point count either way.
 */
export const TRACK_WINDOWS: readonly TrackWindow[] = [
  { label: "1 t", hours: 1 },
  { label: "6 t", hours: 6 },
  { label: "24 t", hours: 24 },
  { label: "7 d", hours: 24 * 7 },
];

/** Default look-back window used when a vessel is first selected. */
export const DEFAULT_TRACK_WINDOW: TrackWindow =
  TRACK_WINDOWS.find((w) => w.hours === 24) ?? TRACK_WINDOWS[0];

/**
 * Radius options for the locality activity query (issue #12). Brief default is
 * 1 km; the API clamps to [50 m, 50 km].
 */
export const RADIUS_OPTIONS: readonly number[] = [500, 1000, 2000, 5000];

/** Default search radius in meters (brief user story #1). */
export const DEFAULT_RADIUS_METERS = 1000;

/**
 * Look-back window for locality activity. Brief user story #1 is "last 7 days";
 * reuse the TRACK_WINDOWS presets and default to 7 d here.
 */
export const DEFAULT_NEARBY_WINDOW: TrackWindow =
  TRACK_WINDOWS.find((w) => w.hours === 24 * 7) ?? TRACK_WINDOWS[TRACK_WINDOWS.length - 1];

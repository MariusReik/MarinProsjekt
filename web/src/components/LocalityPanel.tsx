import type { Locality, NearbyVessel } from "../api/types";
import { RADIUS_OPTIONS, TRACK_WINDOWS, type TrackWindow } from "../config";

export interface NearbyState {
  loading: boolean;
  error: string | null;
  vessels: NearbyVessel[];
}

interface LocalityPanelProps {
  locality: Locality;
  radiusMeters: number;
  onSelectRadius: (radiusMeters: number) => void;
  window: TrackWindow;
  onSelectWindow: (window: TrackWindow) => void;
  state: NearbyState;
  onSelectVessel: (mmsi: number) => void;
  onClose: () => void;
}

/**
 * Panel for a selected aquaculture locality (issue #12): pick a radius and time
 * window, then list the vessels that were active within that radius — the
 * "vessel activity as an event list" half of brief user story #1. Clicking a
 * row selects that vessel so its historical track is drawn.
 */
export function LocalityPanel({
  locality,
  radiusMeters,
  onSelectRadius,
  window,
  onSelectWindow,
  state,
  onSelectVessel,
  onClose,
}: LocalityPanelProps) {
  return (
    <div className="panel">
      <h2>{locality.name}</h2>
      <div className="mmsi">Lokalitet {locality.localityNo}</div>

      <div className="filter-label">Radius</div>
      <div className="track-filter" role="group" aria-label="Søkeradius">
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={r === radiusMeters ? "active" : ""}
            aria-pressed={r === radiusMeters}
            onClick={() => onSelectRadius(r)}
          >
            {formatRadius(r)}
          </button>
        ))}
      </div>

      <div className="filter-label">Tidsvindu</div>
      <div className="track-filter" role="group" aria-label="Tidsvindu">
        {TRACK_WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            className={w.hours === window.hours ? "active" : ""}
            aria-pressed={w.hours === window.hours}
            onClick={() => onSelectWindow(w)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <p className="track-note" aria-live="polite">
        {summary(state, radiusMeters, window)}
      </p>

      {state.vessels.length > 0 && (
        <ul className="nearby-list">
          {state.vessels.map((v) => (
            <li key={v.mmsi}>
              <button type="button" onClick={() => onSelectVessel(v.mmsi)}>
                <span className="nearby-name">{v.name ?? `MMSI ${v.mmsi}`}</span>
                <span className="nearby-meta">
                  {formatDistance(v.minDistanceMeters)} · {v.positionCount} pos ·{" "}
                  {formatTime(v.lastSeen)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-actions">
        <button type="button" onClick={onClose}>
          Lukk
        </button>
      </div>
    </div>
  );
}

function summary(state: NearbyState, radiusMeters: number, w: TrackWindow): string {
  const scope = `innen ${formatRadius(radiusMeters)}, siste ${w.label}`;
  if (state.loading) return `Henter fartøysaktivitet (${scope})…`;
  if (state.error) return `Kunne ikke hente aktivitet: ${state.error}`;
  if (state.vessels.length === 0) return `Ingen fartøysaktivitet ${scope}.`;
  const n = state.vessels.length;
  return `${n} ${n === 1 ? "fartøy" : "fartøy"} (${scope}).`;
}

function formatRadius(meters: number): string {
  return meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("nb-NO");
}

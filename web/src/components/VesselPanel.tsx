import type { Position } from "../api/types";
import { TRACK_WINDOWS, type TrackWindow } from "../config";

export interface TrackState {
  loading: boolean;
  error: string | null;
  count: number;
}

interface VesselPanelProps {
  position: Position;
  name: string | null;
  trackState: TrackState;
  trackWindow: TrackWindow;
  onSelectWindow: (window: TrackWindow) => void;
  onClose: () => void;
}

export function VesselPanel({
  position,
  name,
  trackState,
  trackWindow,
  onSelectWindow,
  onClose,
}: VesselPanelProps) {
  return (
    <div className="panel">
      <h2>{name ?? "Ukjent fartøy"}</h2>
      <div className="mmsi">MMSI {position.mmsi}</div>
      <dl>
        <dt>Fart</dt>
        <dd>{formatSog(position.sog)}</dd>
        <dt>Kurs</dt>
        <dd>{formatCog(position.cog)}</dd>
        <dt>Posisjon</dt>
        <dd>
          {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
        </dd>
        <dt>Sist sett</dt>
        <dd>{formatTime(position.msgtime)}</dd>
      </dl>

      <div
        className="track-filter"
        role="group"
        aria-label="Tidsvindu for historisk spor"
      >
        {TRACK_WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            className={w.hours === trackWindow.hours ? "active" : ""}
            aria-pressed={w.hours === trackWindow.hours}
            onClick={() => onSelectWindow(w)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <p className="track-note" aria-live="polite">
        {trackLabel(trackState, trackWindow)}
      </p>

      <div className="panel-actions">
        <button type="button" onClick={onClose}>
          Lukk
        </button>
      </div>
    </div>
  );
}

function trackLabel(t: TrackState, w: TrackWindow): string {
  const window = `siste ${w.label}`;
  if (t.loading) return `Henter spor (${window})…`;
  if (t.error) return `Kunne ikke hente spor: ${t.error}`;
  if (t.count < 2) return `Ingen sammenhengende spor ${window}.`;
  return `Spor tegnet: ${t.count} posisjoner (${window}).`;
}

function formatSog(sog: number | null): string {
  return sog == null ? "–" : `${sog.toFixed(1)} kn`;
}

function formatCog(cog: number | null): string {
  return cog == null ? "–" : `${Math.round(cog)}°`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("nb-NO");
}

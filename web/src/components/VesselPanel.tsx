import type { Position } from "../api/types";

export interface TrackState {
  loading: boolean;
  error: string | null;
  count: number;
}

interface VesselPanelProps {
  position: Position;
  name: string | null;
  trackState: TrackState;
  onClose: () => void;
}

export function VesselPanel({ position, name, trackState, onClose }: VesselPanelProps) {
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

      <p className="track-note">{trackLabel(trackState)}</p>

      <div className="panel-actions">
        <button type="button" onClick={onClose}>
          Lukk
        </button>
      </div>
    </div>
  );
}

function trackLabel(t: TrackState): string {
  if (t.loading) return "Henter spor (siste 24 t)…";
  if (t.error) return `Kunne ikke hente spor: ${t.error}`;
  if (t.count < 2) return "Ingen sammenhengende spor siste 24 t.";
  return `Spor tegnet: ${t.count} posisjoner (siste 24 t).`;
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

import type { ConnectionStatus } from "../api/positionStream";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Kobler til…",
  connected: "Live",
  disconnected: "Frakoblet – prøver på nytt",
};

interface StatusBarProps {
  status: ConnectionStatus;
  vesselCount: number;
}

export function StatusBar({ status, vesselCount }: StatusBarProps) {
  return (
    <div className="statusbar">
      <span className={`status-dot ${status}`} aria-hidden />
      <h1>Marin overvåkning</h1>
      <span className="status-meta">{LABELS[status]}</span>
      <span className="status-meta">· {vesselCount} fartøy</span>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { Position } from "./api/types";
import { fetchTrack } from "./api/client";
import { useLivePositions } from "./hooks/useLivePositions";
import { MapView } from "./map/MapView";
import { StatusBar } from "./components/StatusBar";
import { VesselPanel, type TrackState } from "./components/VesselPanel";

const NO_TRACK: TrackState = { loading: false, error: null, count: 0 };

export function App() {
  const { store, vesselNames, status, error } = useLivePositions();

  const [selectedMmsi, setSelectedMmsi] = useState<number | null>(null);
  const [track, setTrack] = useState<Position[] | null>(null);
  const [trackState, setTrackState] = useState<TrackState>(NO_TRACK);

  // Lightweight 1 Hz tick so the vessel count and the selected-vessel panel
  // reflect live store updates (the store is a ref and doesn't re-render).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const onSelectVessel = useCallback((pos: Position | null) => {
    setSelectedMmsi(pos ? pos.mmsi : null);
  }, []);

  // Fetch the historical track whenever the selection changes.
  useEffect(() => {
    if (selectedMmsi == null) {
      setTrack(null);
      setTrackState(NO_TRACK);
      return;
    }
    const controller = new AbortController();
    setTrackState({ loading: true, error: null, count: 0 });
    fetchTrack(selectedMmsi, controller.signal)
      .then((t) => {
        setTrack(t);
        setTrackState({ loading: false, error: null, count: t.length });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setTrack(null);
          setTrackState({ loading: false, error: errMessage(err), count: 0 });
        }
      });
    return () => controller.abort();
  }, [selectedMmsi]);

  const selectedPosition = selectedMmsi != null ? (store.current.get(selectedMmsi) ?? null) : null;

  return (
    <div className="app">
      <MapView
        store={store}
        selectedMmsi={selectedMmsi}
        track={track}
        onSelectVessel={onSelectVessel}
      />

      <StatusBar status={status} vesselCount={store.current.size} />

      {selectedPosition && (
        <VesselPanel
          position={selectedPosition}
          name={vesselNames.get(selectedPosition.mmsi) ?? null}
          trackState={trackState}
          onClose={() => setSelectedMmsi(null)}
        />
      )}

      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

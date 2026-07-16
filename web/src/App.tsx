import { useCallback, useEffect, useState } from "react";
import type { Locality, Position } from "./api/types";
import { fetchLocalities, fetchNearbyVessels, fetchTrack } from "./api/client";
import {
  DEFAULT_NEARBY_WINDOW,
  DEFAULT_RADIUS_METERS,
  DEFAULT_TRACK_WINDOW,
  type TrackWindow,
} from "./config";
import { useLivePositions } from "./hooks/useLivePositions";
import { MapView } from "./map/MapView";
import { StatusBar } from "./components/StatusBar";
import { LayerToggle } from "./components/LayerToggle";
import { VesselPanel, type TrackState } from "./components/VesselPanel";
import { LocalityPanel, type NearbyState } from "./components/LocalityPanel";

const NO_TRACK: TrackState = { loading: false, error: null, count: 0 };
const NO_NEARBY: NearbyState = { loading: false, error: null, vessels: [] };

export function App() {
  const { store, vesselNames, status, error } = useLivePositions();

  const [selectedMmsi, setSelectedMmsi] = useState<number | null>(null);
  const [track, setTrack] = useState<Position[] | null>(null);
  const [trackState, setTrackState] = useState<TrackState>(NO_TRACK);
  // Persisted across selections so the chosen time filter sticks (issue #10).
  const [trackWindow, setTrackWindow] = useState<TrackWindow>(DEFAULT_TRACK_WINDOW);

  // Locality activity query (issue #12).
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selectedLocalityNo, setSelectedLocalityNo] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);
  const [nearbyWindow, setNearbyWindow] = useState<TrackWindow>(DEFAULT_NEARBY_WINDOW);
  const [nearbyState, setNearbyState] = useState<NearbyState>(NO_NEARBY);
  // Locality layer visibility toggle (issue #13).
  const [localitiesVisible, setLocalitiesVisible] = useState(true);

  // Lightweight 1 Hz tick so the vessel count and the selected-vessel panel
  // reflect live store updates (the store is a ref and doesn't re-render).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Map click on a vessel: leave locality mode and show the vessel.
  const onSelectVessel = useCallback((pos: Position | null) => {
    setSelectedMmsi(pos ? pos.mmsi : null);
    if (pos) setSelectedLocalityNo(null);
  }, []);

  // Map click on a locality: fresh locality context, drop any drawn track.
  const onSelectLocality = useCallback((localityNo: number | null) => {
    setSelectedLocalityNo(localityNo);
    setSelectedMmsi(null);
  }, []);

  // Toggle the locality layer (issue #13). Hiding it also clears any locality
  // selection so the radius overlay and activity panel disappear with the layer.
  const onToggleLocalities = useCallback((visible: boolean) => {
    setLocalitiesVisible(visible);
    if (!visible) setSelectedLocalityNo(null);
  }, []);

  // Click a row in the locality's activity list: draw that vessel's track but
  // stay in locality context (the list is the "event list", the track the map).
  const onSelectNearbyVessel = useCallback((mmsi: number) => {
    setSelectedMmsi(mmsi);
  }, []);

  // Load localities once for the map layer and selection.
  useEffect(() => {
    const controller = new AbortController();
    fetchLocalities(controller.signal)
      .then(setLocalities)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) console.error("Failed to load localities:", err);
      });
    return () => controller.abort();
  }, []);

  // Fetch the historical track whenever the selection or time window changes.
  useEffect(() => {
    if (selectedMmsi == null) {
      setTrack(null);
      setTrackState(NO_TRACK);
      return;
    }
    const controller = new AbortController();
    setTrackState({ loading: true, error: null, count: 0 });
    fetchTrack(selectedMmsi, trackWindow.hours, controller.signal)
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
  }, [selectedMmsi, trackWindow]);

  // Fetch vessel activity near the selected locality.
  useEffect(() => {
    if (selectedLocalityNo == null) {
      setNearbyState(NO_NEARBY);
      return;
    }
    const controller = new AbortController();
    setNearbyState({ loading: true, error: null, vessels: [] });
    fetchNearbyVessels(selectedLocalityNo, radiusMeters, nearbyWindow.hours, controller.signal)
      .then((vessels) => setNearbyState({ loading: false, error: null, vessels }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setNearbyState({ loading: false, error: errMessage(err), vessels: [] });
        }
      });
    return () => controller.abort();
  }, [selectedLocalityNo, radiusMeters, nearbyWindow]);

  const selectedPosition = selectedMmsi != null ? (store.current.get(selectedMmsi) ?? null) : null;
  const selectedLocality =
    selectedLocalityNo != null
      ? (localities.find((l) => l.localityNo === selectedLocalityNo) ?? null)
      : null;

  return (
    <div className="app">
      <MapView
        store={store}
        selectedMmsi={selectedMmsi}
        track={track}
        onSelectVessel={onSelectVessel}
        localities={localities}
        selectedLocalityNo={selectedLocalityNo}
        radiusMeters={radiusMeters}
        localitiesVisible={localitiesVisible}
        onSelectLocality={onSelectLocality}
      />

      <StatusBar status={status} vesselCount={store.current.size} />

      <LayerToggle
        localitiesVisible={localitiesVisible}
        localityCount={localities.length}
        onToggleLocalities={onToggleLocalities}
      />

      {selectedLocality ? (
        <LocalityPanel
          locality={selectedLocality}
          radiusMeters={radiusMeters}
          onSelectRadius={setRadiusMeters}
          window={nearbyWindow}
          onSelectWindow={setNearbyWindow}
          state={nearbyState}
          onSelectVessel={onSelectNearbyVessel}
          onClose={() => setSelectedLocalityNo(null)}
        />
      ) : (
        selectedPosition && (
          <VesselPanel
            position={selectedPosition}
            name={vesselNames.get(selectedPosition.mmsi) ?? null}
            trackState={trackState}
            trackWindow={trackWindow}
            onSelectWindow={setTrackWindow}
            onClose={() => setSelectedMmsi(null)}
          />
        )
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

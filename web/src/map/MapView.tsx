import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import type { Position } from "../api/types";
import { MAP_CENTER, MAP_INITIAL_ZOOM, MAP_REFRESH_INTERVAL_MS } from "../config";
import { OSM_RASTER_STYLE } from "./mapStyle";
import { EMPTY_FC, trackToGeoJson, vesselsToGeoJson } from "./geojson";

const VESSEL_SOURCE = "vessels";
const VESSEL_LAYER = "vessels-circle";
const TRACK_SOURCE = "track";
const TRACK_LAYER = "track-line";

interface MapViewProps {
  store: React.MutableRefObject<Map<number, Position>>;
  selectedMmsi: number | null;
  track: Position[] | null;
  onSelectVessel: (position: Position | null) => void;
}

/**
 * MapLibre GL map rendering live vessel positions as a data-driven circle
 * layer, plus the selected vessel's historical track as a line. Vessel updates
 * are applied imperatively on a throttled interval (reading the position store
 * ref) rather than through React state, so a busy WebSocket feed never causes a
 * React re-render per frame.
 */
export function MapView({ store, selectedMmsi, track, onSelectVessel }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const selectedRef = useRef<number | null>(selectedMmsi);

  // Keep the latest callback/selection in refs so the map's event handlers and
  // redraw interval (registered once) always see current values.
  const onSelectRef = useRef(onSelectVessel);
  onSelectRef.current = onSelectVessel;
  selectedRef.current = selectedMmsi;

  // --- Map init (once) --------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_RASTER_STYLE,
      center: MAP_CENTER,
      zoom: MAP_INITIAL_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource(TRACK_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: TRACK_LAYER,
        type: "line",
        source: TRACK_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fbbf24", "line-width": 3, "line-opacity": 0.85 },
      });

      map.addSource(VESSEL_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: VESSEL_LAYER,
        type: "circle",
        source: VESSEL_SOURCE,
        paint: {
          "circle-radius": ["case", ["get", "selected"], 8, 4],
          "circle-color": ["case", ["get", "selected"], "#fbbf24", "#2dd4bf"],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0b1622",
          "circle-opacity": 0.9,
        },
      });

      readyRef.current = true;
      redraw(); // paint the initial snapshot immediately
    });

    const handleVesselClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const mmsi = Number(feature.properties?.mmsi);
      // Prefer the fully-typed Position from the store over feature props.
      const pos = store.current.get(mmsi) ?? null;
      onSelectRef.current(pos);
    };

    const handleMapClick = (e: MapLayerMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [VESSEL_LAYER] });
      if (hits.length === 0) {
        onSelectRef.current(null); // click on empty water clears selection
      }
    };

    map.on("click", VESSEL_LAYER, handleVesselClick);
    map.on("click", handleMapClick);
    map.on("mouseenter", VESSEL_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", VESSEL_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    // Redraw vessels on a fixed cadence, decoupled from message arrival.
    const timer = window.setInterval(redraw, MAP_REFRESH_INTERVAL_MS);

    function redraw() {
      if (!readyRef.current) return;
      const source = map.getSource(VESSEL_SOURCE) as GeoJSONSource | undefined;
      source?.setData(vesselsToGeoJson(store.current, selectedRef.current));
    }

    return () => {
      window.clearInterval(timer);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // store is a stable ref; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Track updates ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const source = map.getSource(TRACK_SOURCE) as GeoJSONSource | undefined;
    source?.setData(track ? trackToGeoJson(track) : EMPTY_FC);
  }, [track]);

  return <div ref={containerRef} className="map" />;
}

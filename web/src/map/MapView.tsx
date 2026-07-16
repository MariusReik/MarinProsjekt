import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import type { Locality, Position } from "../api/types";
import { MAP_CENTER, MAP_INITIAL_ZOOM, MAP_REFRESH_INTERVAL_MS } from "../config";
import { OSM_RASTER_STYLE } from "./mapStyle";
import {
  EMPTY_FC,
  localitiesToGeoJson,
  radiusCircleToGeoJson,
  trackToGeoJson,
  vesselsToGeoJson,
} from "./geojson";

const VESSEL_SOURCE = "vessels";
const VESSEL_LAYER = "vessels-circle";
const TRACK_SOURCE = "track";
const TRACK_LAYER = "track-line";
const TRACK_ARROW_LAYER = "track-arrows";
const ARROW_IMAGE = "track-arrow";
const LOCALITY_SOURCE = "localities";
const LOCALITY_LAYER = "localities-circle";
const RADIUS_SOURCE = "radius";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_LINE_LAYER = "radius-line";

/**
 * Build a small upward-pointing arrowhead as raster RGBA pixels for map.addImage.
 * On a line symbol layer, MapLibre rotates the icon so its "up" edge follows the
 * line's coordinate order — the track is drawn oldest→newest, so the arrows end
 * up pointing in the vessel's direction of travel. Drawn on a canvas (no sprite
 * or glyph assets, keeping the API-key-free style, brief §6).
 */
function makeArrowIcon(): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fully transparent fallback; the line itself still conveys the path.
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }
  ctx.beginPath();
  ctx.moveTo(size / 2, 4); // apex (up)
  ctx.lineTo(size - 5, size - 6); // bottom-right
  ctx.lineTo(5, size - 6); // bottom-left
  ctx.closePath();
  ctx.fillStyle = "#fbbf24";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0b1622";
  ctx.stroke();
  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

interface MapViewProps {
  store: React.MutableRefObject<Map<number, Position>>;
  selectedMmsi: number | null;
  track: Position[] | null;
  onSelectVessel: (position: Position | null) => void;
  localities: Locality[];
  selectedLocalityNo: number | null;
  radiusMeters: number;
  localitiesVisible: boolean;
  onSelectLocality: (localityNo: number | null) => void;
}

/**
 * MapLibre GL map rendering live vessel positions as a data-driven circle
 * layer, plus the selected vessel's historical track as a line. Vessel updates
 * are applied imperatively on a throttled interval (reading the position store
 * ref) rather than through React state, so a busy WebSocket feed never causes a
 * React re-render per frame. Aquaculture localities (issue #12) are drawn as a
 * second POI layer; selecting one draws its search radius and drives the
 * "vessels within radius" query in the parent.
 */
export function MapView({
  store,
  selectedMmsi,
  track,
  onSelectVessel,
  localities,
  selectedLocalityNo,
  radiusMeters,
  localitiesVisible,
  onSelectLocality,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const selectedRef = useRef<number | null>(selectedMmsi);

  // Keep the latest callbacks/selection in refs so the map's event handlers and
  // redraw interval (registered once) always see current values.
  const onSelectRef = useRef(onSelectVessel);
  const onSelectLocalityRef = useRef(onSelectLocality);
  onSelectRef.current = onSelectVessel;
  onSelectLocalityRef.current = onSelectLocality;
  selectedRef.current = selectedMmsi;

  // Latest locality props mirrored into refs the once-registered draw closures
  // read, plus refs holding those closures so the update effects can invoke them.
  const localitiesRef = useRef(localities);
  const selectedLocalityRef = useRef(selectedLocalityNo);
  const radiusRef = useRef(radiusMeters);
  const localitiesVisibleRef = useRef(localitiesVisible);
  const drawLocalitiesRef = useRef<() => void>(() => {});
  const drawRadiusRef = useRef<() => void>(() => {});
  const applyLocalityVisibilityRef = useRef<(visible: boolean) => void>(() => {});
  localitiesRef.current = localities;
  selectedLocalityRef.current = selectedLocalityNo;
  radiusRef.current = radiusMeters;
  localitiesVisibleRef.current = localitiesVisible;

  // The locality/radius layer ids toggled together as one logical "localities"
  // layer (issue #13).
  const LOCALITY_LAYER_IDS = [LOCALITY_LAYER, RADIUS_FILL_LAYER, RADIUS_LINE_LAYER];

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

      // Direction-of-travel arrowheads spaced along the track line.
      if (!map.hasImage(ARROW_IMAGE)) {
        map.addImage(ARROW_IMAGE, makeArrowIcon(), { pixelRatio: 2 });
      }
      map.addLayer({
        id: TRACK_ARROW_LAYER,
        type: "symbol",
        source: TRACK_SOURCE,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 90,
          "icon-image": ARROW_IMAGE,
          "icon-size": 0.7,
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Search-radius overlay for the selected locality (kept beneath vessels).
      map.addSource(RADIUS_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: RADIUS_FILL_LAYER,
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { "fill-color": "#a855f7", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: RADIUS_LINE_LAYER,
        type: "line",
        source: RADIUS_SOURCE,
        paint: {
          "line-color": "#a855f7",
          "line-width": 1.5,
          "line-opacity": 0.8,
          "line-dasharray": [2, 2],
        },
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

      // Aquaculture localities as POIs, drawn on top so they stay clickable.
      map.addSource(LOCALITY_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: LOCALITY_LAYER,
        type: "circle",
        source: LOCALITY_SOURCE,
        paint: {
          "circle-radius": ["case", ["get", "selected"], 9, 6],
          "circle-color": "#a855f7",
          "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
          "circle-stroke-color": ["case", ["get", "selected"], "#fbbf24", "#e6edf3"],
          "circle-opacity": 0.95,
        },
      });

      // Apply the current layer visibility before the first paint so the
      // localities honour a toggle set while the style was still loading.
      applyLocalityVisibility(localitiesVisibleRef.current);

      readyRef.current = true;
      redraw(); // paint the initial snapshot immediately
      // Paint any localities/radius already provided before load finished.
      drawLocalities();
      drawRadius();
    });

    function applyLocalityVisibility(visible: boolean) {
      const visibility = visible ? "visible" : "none";
      for (const id of LOCALITY_LAYER_IDS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
      }
    }
    applyLocalityVisibilityRef.current = applyLocalityVisibility;

    const handleVesselClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const mmsi = Number(feature.properties?.mmsi);
      // Prefer the fully-typed Position from the store over feature props.
      const pos = store.current.get(mmsi) ?? null;
      onSelectRef.current(pos);
    };

    const handleLocalityClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      onSelectLocalityRef.current(Number(feature.properties?.localityNo));
    };

    const handleMapClick = (e: MapLayerMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [VESSEL_LAYER, LOCALITY_LAYER],
      });
      if (hits.length === 0) {
        // Click on empty water clears both selections.
        onSelectRef.current(null);
        onSelectLocalityRef.current(null);
      }
    };

    map.on("click", VESSEL_LAYER, handleVesselClick);
    map.on("click", LOCALITY_LAYER, handleLocalityClick);
    map.on("click", handleMapClick);
    for (const layer of [VESSEL_LAYER, LOCALITY_LAYER]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // Redraw vessels on a fixed cadence, decoupled from message arrival.
    const timer = window.setInterval(redraw, MAP_REFRESH_INTERVAL_MS);

    function redraw() {
      if (!readyRef.current) return;
      const source = map.getSource(VESSEL_SOURCE) as GeoJSONSource | undefined;
      source?.setData(vesselsToGeoJson(store.current, selectedRef.current));
    }

    function drawLocalities() {
      if (!readyRef.current) return;
      const source = map.getSource(LOCALITY_SOURCE) as GeoJSONSource | undefined;
      source?.setData(localitiesToGeoJson(localitiesRef.current, selectedLocalityRef.current));
    }

    function drawRadius() {
      if (!readyRef.current) return;
      const source = map.getSource(RADIUS_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      const selected = localitiesRef.current.find(
        (l) => l.localityNo === selectedLocalityRef.current,
      );
      source.setData(
        selected
          ? radiusCircleToGeoJson([selected.longitude, selected.latitude], radiusRef.current)
          : EMPTY_FC,
      );
    }

    drawLocalitiesRef.current = drawLocalities;
    drawRadiusRef.current = drawRadius;

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

  // --- Locality layer updates -------------------------------------------
  useEffect(() => {
    drawLocalitiesRef.current();
  }, [localities, selectedLocalityNo]);

  // --- Radius overlay updates -------------------------------------------
  useEffect(() => {
    drawRadiusRef.current();
  }, [localities, selectedLocalityNo, radiusMeters]);

  // --- Locality layer visibility toggle (issue #13) ---------------------
  useEffect(() => {
    if (!readyRef.current) return;
    applyLocalityVisibilityRef.current(localitiesVisible);
  }, [localitiesVisible]);

  return <div ref={containerRef} className="map" />;
}

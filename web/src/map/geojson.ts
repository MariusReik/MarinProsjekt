import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import type { Locality, Position } from "../api/types";

export interface VesselFeatureProps {
  mmsi: number;
  sog: number | null;
  cog: number | null;
  msgtime: string;
  selected: boolean;
}

/** Build a point FeatureCollection of current vessel positions for the map. */
export function vesselsToGeoJson(
  store: Map<number, Position>,
  selectedMmsi: number | null,
): FeatureCollection<Point, VesselFeatureProps> {
  const features: Feature<Point, VesselFeatureProps>[] = [];
  for (const p of store.values()) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: {
        mmsi: p.mmsi,
        sog: p.sog,
        cog: p.cog,
        msgtime: p.msgtime,
        selected: p.mmsi === selectedMmsi,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Build a LineString from a vessel track. The API returns rows newest-first,
 * so reverse to draw the line in chronological order.
 */
export function trackToGeoJson(track: Position[]): FeatureCollection<LineString> {
  if (track.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  const coordinates = [...track]
    .reverse()
    .map((p) => [p.longitude, p.latitude] as [number, number]);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {},
      },
    ],
  };
}

export interface LocalityFeatureProps {
  localityNo: number;
  name: string;
  selected: boolean;
}

/** Build a point FeatureCollection of aquaculture localities (issue #12). */
export function localitiesToGeoJson(
  localities: Locality[],
  selectedLocalityNo: number | null,
): FeatureCollection<Point, LocalityFeatureProps> {
  return {
    type: "FeatureCollection",
    features: localities.map((l) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [l.longitude, l.latitude] },
      properties: {
        localityNo: l.localityNo,
        name: l.name,
        selected: l.localityNo === selectedLocalityNo,
      },
    })),
  };
}

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Approximate a geodesic circle as a Polygon so the search radius can be drawn
 * on the map. Uses the destination-point formula on a sphere; at these radii
 * (≤ 50 km) and latitudes the spherical error is negligible for a UI overlay.
 */
export function radiusCircleToGeoJson(
  center: [number, number],
  radiusMeters: number,
  steps = 64,
): FeatureCollection<Polygon> {
  const [lon, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const angular = radiusMeters / EARTH_RADIUS_M;
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;
    const sinLat = Math.sin(latRad) * Math.cos(angular) +
      Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing);
    const pointLat = Math.asin(sinLat);
    const y = Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad);
    const x = Math.cos(angular) - Math.sin(latRad) * sinLat;
    const pointLon = (lon * Math.PI) / 180 + Math.atan2(y, x);
    ring.push([(pointLon * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {},
      },
    ],
  };
}

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Position } from "../api/types";

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

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

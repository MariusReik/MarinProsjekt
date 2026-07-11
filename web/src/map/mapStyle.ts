import type { StyleSpecification } from "maplibre-gl";

/**
 * Minimal MapLibre style backed by OpenStreetMap raster tiles. Chosen over a
 * vector style so the app needs no tile-server API key — matching the brief's
 * "open source, no licence cost" rationale for the frontend (§6). Swap for a
 * self-hosted vector style if/when tile usage policy becomes a concern.
 */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

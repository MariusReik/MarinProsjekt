import type { BoundingBox } from './config.js';

/** True if the coordinate lies inside the box (bounds inclusive). */
export function inBoundingBox(latitude: number, longitude: number, box: BoundingBox): boolean {
  return (
    latitude >= box.minLat &&
    latitude <= box.maxLat &&
    longitude >= box.minLon &&
    longitude <= box.maxLon
  );
}

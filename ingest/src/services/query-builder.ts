export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function buildQueryParams(box: BoundingBox): URLSearchParams {
  const params = new URLSearchParams();
  params.set('minLat', box.minLat.toString());
  params.set('maxLat', box.maxLat.toString());
  params.set('minLon', box.minLon.toString());
  params.set('maxLon', box.maxLon.toString());
  return params;
}

// Maps one raw Fiskehelse locality row to a domain Locality.
//
// The exact field names of the bwapi localities payload are not verified
// against a live response in this sandbox (no credentials here), so extraction
// is deliberately tolerant of the common variants seen in the Barentswatch
// docs/service: locality number as localityNo/localityNumber/id, coordinates as
// lat/lon or latitude/longitude, name as name/localityName. Structurally
// invalid rows (missing number/name or out-of-range coordinates) return null
// and are skipped rather than crashing the refresh.

export interface Locality {
  localityNo: number;
  name: string;
  latitude: number;
  longitude: number;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === '') {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function mapLocality(raw: unknown): Locality | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;

  const localityNo = firstNumber(row, ['localityNo', 'localityNumber', 'localityId', 'id']);
  if (localityNo === null || !Number.isInteger(localityNo) || localityNo <= 0) {
    return null;
  }

  const name = firstString(row, ['name', 'localityName']);
  if (name === null) {
    return null;
  }

  const latitude = firstNumber(row, ['lat', 'latitude']);
  const longitude = firstNumber(row, ['lon', 'lng', 'longitude']);
  if (latitude === null || latitude < -90 || latitude > 90) {
    return null;
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    return null;
  }

  return { localityNo, name, latitude, longitude };
}

export interface AISPosition {
  mmsi: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  sog?: number;
  cog?: number;
  heading?: number;
}

export interface BarentswatchApiResponse {
  data?: AISPosition[];
  [key: string]: unknown;
}

export async function fetchBarentswatchPositions(
  endpoint: string,
  token: string,
): Promise<AISPosition[]> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Barentswatch request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BarentswatchApiResponse;
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows.map((row) => ({
    mmsi: Number(row.mmsi),
    timestamp: String(row.timestamp ?? ''),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    sog: row.sog != null ? Number(row.sog) : undefined,
    cog: row.cog != null ? Number(row.cog) : undefined,
    heading: row.heading != null ? Number(row.heading) : undefined,
  }));
}

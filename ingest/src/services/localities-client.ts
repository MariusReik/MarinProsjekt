// Fetches the aquaculture localities list from the Barentswatch Fiskehelse
// (bwapi) API. Auth is the same token flow as AIS but with scope 'api'
// (see TokenProvider). This module only does the HTTP call and returns the
// raw rows; validation/normalisation lives in locality-mapper.ts so it can be
// unit tested without a network or a real token.

/**
 * GET the localities list and return the raw rows.
 * The endpoint returns either a bare JSON array or an object wrapping the rows
 * under `data`/`localities` — both shapes are handled defensively.
 * @throws Error on a non-2xx response.
 */
export async function fetchLocalities(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<unknown[]> {
  const response = await fetchFn(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Localities request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data;
    }
    if (Array.isArray(record.localities)) {
      return record.localities;
    }
  }
  return [];
}

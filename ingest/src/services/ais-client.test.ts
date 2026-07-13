import test from 'node:test';
import assert from 'node:assert/strict';

import { AISClient, isValidPosition } from './ais-client.js';

test('isValidPosition rejects out-of-range coordinates', () => {
  assert.equal(isValidPosition({ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 91, longitude: 5 }), false);
  assert.equal(isValidPosition({ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }), true);
});

test('AISClient fetchLatestPositions uses the token and filters invalid positions', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, _init) => {
    return new Response(JSON.stringify({ data: [{ mmsi: '123', timestamp: '2026-07-06T00:00:00Z', latitude: '60.1', longitude: '5.2' }, { mmsi: '456', timestamp: '2026-07-06T00:00:00Z', latitude: '100', longitude: '5.2' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new AISClient({
      endpoint: 'https://example.test/ais',
      tokenProvider: {
        getAccessToken: async () => 'token',
      } as any,
      config: {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        tokenUrl: 'https://example.test/token',
        streamUrl: 'https://example.test/stream',
        databaseUrl: 'postgres://test',
        boundingBox: { minLat: 59.0, maxLat: 62.5, minLon: 3.5, maxLon: 8.0 },
        localitiesUrl: 'https://example.test/localities',
        localitiesScope: 'api',
        localitiesRefreshMs: 86_400_000,
      },
    });

    const positions = await client.fetchLatestPositions();

    assert.equal(positions.length, 1);
    assert.equal(positions[0].mmsi, 123);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

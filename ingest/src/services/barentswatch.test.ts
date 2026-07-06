import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchBarentswatchPositions } from './barentswatch.js';

test('fetchBarentswatchPositions normalizes payload rows', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, _init) => {
    return new Response(JSON.stringify({ data: [{ mmsi: '123456789', timestamp: '2026-07-06T10:00:00Z', latitude: '60.1', longitude: '5.2', sog: '12.3' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const positions = await fetchBarentswatchPositions('https://example.test/ais', 'token');

    assert.equal(positions.length, 1);
    assert.equal(positions[0].mmsi, 123456789);
    assert.equal(positions[0].latitude, 60.1);
    assert.equal(positions[0].longitude, 5.2);
    assert.equal(positions[0].sog, 12.3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

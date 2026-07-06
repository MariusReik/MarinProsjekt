import test from 'node:test';
import assert from 'node:assert/strict';

import { startIngestService } from './index.js';

test('startIngestService returns a startup summary', async () => {
  const summary = await startIngestService({
    client: {
      fetchLatestPositions: async () => [{ mmsi: 123, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }],
    } as any,
  });

  assert.equal(summary.status, 'started');
  assert.equal(summary.service, 'marin-ingest');
  assert.equal(summary.positionsFetched, 1);
});

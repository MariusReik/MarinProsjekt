import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startIngestService } from './index.js';
import { JsonFileStore } from './storage/json-file-store.js';

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

test('startIngestService writes fetched positions to the configured store', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'marin-ingest-'));
  const outputPath = join(tempDir, 'positions.json');
  const store = new JsonFileStore({ outputPath });

  const summary = await startIngestService({
    client: {
      fetchLatestPositions: async () => [{ mmsi: 456, timestamp: '2026-07-06T00:00:00Z', latitude: 61, longitude: 6 }],
    } as any,
    store,
  });

  const contents = await readFile(outputPath, 'utf8');

  assert.match(contents, /"mmsi": 456/);
  assert.equal(summary.positionsFetched, 1);
  assert.equal(summary.storedAt, outputPath);

  await rm(tempDir, { recursive: true, force: true });
});

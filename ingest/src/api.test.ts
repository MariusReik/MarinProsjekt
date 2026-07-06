import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApiServer } from './api.js';
import { JsonFileStore } from './storage/json-file-store.js';

test('createApiServer exposes health and positions endpoints', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'marin-ingest-api-'));
  const outputPath = join(tempDir, 'positions.json');
  const store = new JsonFileStore({ outputPath });
  await store.save([{ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }]);

  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server address missing');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${baseUrl}/health`);
  const positions = await fetch(`${baseUrl}/positions`);

  assert.equal(health.status, 200);
  assert.equal(positions.status, 200);
  const body = await positions.json();
  assert.equal(body[0].mmsi, 1);

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(tempDir, { recursive: true, force: true });
});

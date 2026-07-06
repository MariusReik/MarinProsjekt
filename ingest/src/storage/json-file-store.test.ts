import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JsonFileStore } from './json-file-store.js';

test('JsonFileStore writes positions to a JSON file', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'marin-ingest-'));
  const outputPath = join(tempDir, 'positions.json');
  const store = new JsonFileStore({ outputPath });

  await store.save([{ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }]);

  const contents = await readFile(outputPath, 'utf8');
  assert.match(contents, /"mmsi": 1/);

  await rm(tempDir, { recursive: true, force: true });
});

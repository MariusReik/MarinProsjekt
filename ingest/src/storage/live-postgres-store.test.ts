import test from 'node:test';
import assert from 'node:assert/strict';

import { LivePostgresStore } from './live-postgres-store.js';

test('LivePostgresStore writes and reads payloads through a pool', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      if (text.includes('DELETE FROM')) {
        return { rowCount: 1 };
      }
      if (text.includes('INSERT INTO')) {
        return { rowCount: 1 };
      }
      return { rows: [{ payload: JSON.stringify([{ mmsi: 5, timestamp: '2026-07-06T00:00:00Z', latitude: 63, longitude: 8 }]) }] };
    },
  } as any;

  const store = new LivePostgresStore({ pool });
  await store.save([{ mmsi: 5, timestamp: '2026-07-06T00:00:00Z', latitude: 63, longitude: 8 }]);
  const rows = await store.load();

  assert.equal(rows[0].mmsi, 5);
  assert.equal(queries.length >= 3, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { PostgresPositionStore } from './postgres-store.js';

test('PostgresPositionStore saves and loads positions through a client', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
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
      if (text.includes('SELECT')) {
        return { rows: [{ payload: JSON.stringify([{ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }]) }] };
      }
      throw new Error('unexpected query');
    },
  };

  const store = new PostgresPositionStore({ client: client as any });
  await store.save([{ mmsi: 1, timestamp: '2026-07-06T00:00:00Z', latitude: 60, longitude: 5 }]);
  const rows = await store.load();

  assert.equal(rows[0].mmsi, 1);
  assert.equal(queries.length >= 3, true);
});

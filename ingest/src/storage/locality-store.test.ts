import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalityStore } from './locality-store.js';
import type { Locality } from '../locality-mapper.js';
import type { Logger } from '../logger.js';

const silentLogger: Logger = { info: () => {}, error: () => {} };

function locality(localityNo: number): Locality {
  return { localityNo, name: `L${localityNo}`, latitude: 60, longitude: 5 };
}

function fakeDb() {
  const calls: { text: string; params: unknown[] }[] = [];
  const db = {
    async query(text: string, params: unknown[] = []) {
      calls.push({ text, params });
      return { rowCount: params.length / 4 };
    },
  };
  return { db, calls };
}

test('upsertAll writes a single batched insert with ON CONFLICT', async () => {
  const { db, calls } = fakeDb();
  const store = new LocalityStore({ db, logger: silentLogger });

  const written = await store.upsertAll([locality(1), locality(2)]);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO localities/);
  assert.match(calls[0].text, /ON CONFLICT \(locality_no\) DO UPDATE/);
  assert.match(calls[0].text, /updated_at = NOW\(\)/);
  assert.equal(calls[0].params.length, 8); // 2 rows x 4 columns
  assert.equal(written, 2);
});

test('upsertAll chunks large sets to stay under the parameter limit', async () => {
  const { db, calls } = fakeDb();
  const store = new LocalityStore({ db, logger: silentLogger, chunkSize: 2 });

  const written = await store.upsertAll([locality(1), locality(2), locality(3)]);

  assert.equal(calls.length, 2); // 2 + 1
  assert.equal(calls[0].params.length, 8);
  assert.equal(calls[1].params.length, 4);
  assert.equal(written, 3);
});

test('upsertAll is a no-op for an empty list', async () => {
  const { db, calls } = fakeDb();
  const store = new LocalityStore({ db, logger: silentLogger });

  const written = await store.upsertAll([]);

  assert.equal(calls.length, 0);
  assert.equal(written, 0);
});

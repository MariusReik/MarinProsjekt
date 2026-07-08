import test from 'node:test';
import assert from 'node:assert/strict';
import { TimescaleStore, type Queryable } from './timescale-store.js';
import type { MappedMessage } from '../mapper.js';
import type { Logger } from '../logger.js';

const silentLogger: Logger = { info: () => {}, error: () => {} };

function entry(mmsi: number, iso: string): MappedMessage {
  const msgtime = new Date(iso);
  return {
    position: {
      mmsi,
      msgtime,
      latitude: 60,
      longitude: 5,
      sog: 1,
      cog: null,
      trueHeading: null,
      rateOfTurn: null,
      navStatus: 0,
    },
    vessel: { mmsi, name: `V${mmsi}`, shipType: 70, lastSeen: msgtime },
  };
}

function fakeDb(behaviour?: { failFirst?: boolean }) {
  const calls: { text: string; params: unknown[] }[] = [];
  let failed = false;
  const db: Queryable = {
    async query(text, params = []) {
      if (behaviour?.failFirst && !failed) {
        failed = true;
        throw new Error('connection refused');
      }
      calls.push({ text, params });
      return { rowCount: 1 };
    },
  };
  return { db, calls };
}

test('flush writes positions and vessels with ON CONFLICT handling', async () => {
  const { db, calls } = fakeDb();
  const store = new TimescaleStore({ db, logger: silentLogger });
  store.add(entry(1, '2026-07-07T10:00:00Z'));
  store.add(entry(2, '2026-07-07T10:00:01Z'));
  await store.flush();

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO ais_positions/);
  assert.match(calls[0].text, /ON CONFLICT \(mmsi, msgtime\) DO NOTHING/);
  assert.equal(calls[0].params.length, 18); // 2 rows x 9 columns
  assert.match(calls[1].text, /INSERT INTO vessels/);
  assert.match(calls[1].text, /ON CONFLICT \(mmsi\) DO UPDATE/);
  assert.equal(store.insertedPositions, 2);
  assert.equal(store.bufferedCount, 0);
});

test('vessels are deduplicated by mmsi, latest observation wins', async () => {
  const { db, calls } = fakeDb();
  const store = new TimescaleStore({ db, logger: silentLogger });
  store.add(entry(1, '2026-07-07T10:00:00Z'));
  store.add(entry(1, '2026-07-07T10:05:00Z'));
  await store.flush();

  const vesselCall = calls[1];
  assert.equal(vesselCall.params.length, 4); // one vessel row only
  assert.equal((vesselCall.params[3] as Date).toISOString(), '2026-07-07T10:05:00.000Z');
});

test('reaching maxBatchSize triggers a flush', async () => {
  const { db, calls } = fakeDb();
  const store = new TimescaleStore({ db, logger: silentLogger, maxBatchSize: 2 });
  store.add(entry(1, '2026-07-07T10:00:00Z'));
  store.add(entry(2, '2026-07-07T10:00:01Z'));
  // add() fires flush asynchronously; give it a tick
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
});

test('failed flush re-buffers the batch and retries successfully', async () => {
  const { db, calls } = fakeDb({ failFirst: true });
  const store = new TimescaleStore({ db, logger: silentLogger });
  store.add(entry(1, '2026-07-07T10:00:00Z'));

  await store.flush(); // fails, re-buffers
  assert.equal(store.bufferedCount, 1);
  assert.equal(calls.length, 0);

  await store.flush(); // succeeds
  assert.equal(store.bufferedCount, 0);
  assert.equal(calls.length, 2);
});

test('buffer overflow drops oldest entries instead of growing unbounded', () => {
  const { db } = fakeDb();
  const store = new TimescaleStore({ db, logger: silentLogger, maxBufferSize: 3, maxBatchSize: 100 });
  for (let i = 1; i <= 5; i += 1) {
    store.add(entry(i, '2026-07-07T10:00:00Z'));
  }
  assert.equal(store.bufferedCount, 3);
});

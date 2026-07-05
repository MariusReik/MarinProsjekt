import test from 'node:test';
import assert from 'node:assert/strict';

import { startIngestService } from './index.js';

test('startIngestService returns a startup summary', () => {
  const summary = startIngestService();

  assert.equal(summary.status, 'started');
  assert.equal(summary.service, 'marin-ingest');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQueryParams } from './query-builder.js';

test('buildQueryParams serializes the bounding box values', () => {
  const params = buildQueryParams({ minLat: 58, maxLat: 62, minLon: 4, maxLon: 8 });

  assert.equal(params.get('minLat'), '58');
  assert.equal(params.get('maxLat'), '62');
  assert.equal(params.get('minLon'), '4');
  assert.equal(params.get('maxLon'), '8');
});

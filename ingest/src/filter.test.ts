import test from 'node:test';
import assert from 'node:assert/strict';
import { inBoundingBox } from './filter.js';
import type { BoundingBox } from './config.js';

const box: BoundingBox = { minLat: 59.0, maxLat: 62.5, minLon: 3.5, maxLon: 8.0 };

test('accepts a position inside the box', () => {
  assert.equal(inBoundingBox(60.39, 5.32, box), true); // Bergen
});

test('accepts positions exactly on the bounds', () => {
  assert.equal(inBoundingBox(59.0, 3.5, box), true);
  assert.equal(inBoundingBox(62.5, 8.0, box), true);
});

test('rejects positions outside the box', () => {
  assert.equal(inBoundingBox(64.93, 11.62, box), false); // Trøndelag
  assert.equal(inBoundingBox(79.97, 17.07, box), false); // Svalbard
  assert.equal(inBoundingBox(60.0, 8.5, box), false); // east of box
});

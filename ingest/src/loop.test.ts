import test from 'node:test';
import assert from 'node:assert/strict';

import { createIngestLoop } from './loop.js';

test('createIngestLoop runs the callback on an interval and can stop', async () => {
  let runs = 0;
  const loop = createIngestLoop({
    intervalMs: 20,
    callback: async () => {
      runs += 1;
      if (runs >= 2) {
        loop.stop();
      }
    },
  });

  loop.start();

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(runs, 2);
});

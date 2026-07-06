import test from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from './config.js';

test('loadConfig reads client credentials and token URL from the environment', () => {
  process.env.BW_CLIENT_ID = 'client-id';
  process.env.BW_CLIENT_SECRET = 'client-secret';
  process.env.BW_TOKEN_URL = 'https://example.test/token';

  const config = loadConfig();

  assert.equal(config.clientId, 'client-id');
  assert.equal(config.clientSecret, 'client-secret');
  assert.equal(config.tokenUrl, 'https://example.test/token');
});

test('loadConfig throws a combined error when required variables are missing', () => {
  delete process.env.BW_CLIENT_ID;
  delete process.env.BW_CLIENT_SECRET;
  delete process.env.BW_TOKEN_URL;

  assert.throws(() => loadConfig(), /BW_CLIENT_ID|BW_CLIENT_SECRET/);
});

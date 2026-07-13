import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLocalities } from './localities-client.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  } as unknown as Response;
}

test('returns a bare JSON array unchanged', async () => {
  const rows = [{ localityNo: 1 }, { localityNo: 2 }];
  const fetchFn = (async () => jsonResponse(rows)) as unknown as typeof fetch;

  const result = await fetchLocalities('https://example.test/localities', 'token', fetchFn);
  assert.deepEqual(result, rows);
});

test('unwraps rows nested under data', async () => {
  const rows = [{ localityNo: 1 }];
  const fetchFn = (async () => jsonResponse({ data: rows })) as unknown as typeof fetch;

  const result = await fetchLocalities('https://example.test/localities', 'token', fetchFn);
  assert.deepEqual(result, rows);
});

test('sends a Bearer token', async () => {
  let seenAuth: string | undefined;
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    seenAuth = (init?.headers as Record<string, string>)?.Authorization;
    return jsonResponse([]);
  }) as unknown as typeof fetch;

  await fetchLocalities('https://example.test/localities', 'secret-token', fetchFn);
  assert.equal(seenAuth, 'Bearer secret-token');
});

test('throws on a non-2xx response', async () => {
  const fetchFn = (async () => jsonResponse(null, false, 503)) as unknown as typeof fetch;

  await assert.rejects(
    () => fetchLocalities('https://example.test/localities', 'token', fetchFn),
    /status 503/,
  );
});

test('returns an empty array for an unexpected shape', async () => {
  const fetchFn = (async () => jsonResponse({ unexpected: true })) as unknown as typeof fetch;

  const result = await fetchLocalities('https://example.test/localities', 'token', fetchFn);
  assert.deepEqual(result, []);
});

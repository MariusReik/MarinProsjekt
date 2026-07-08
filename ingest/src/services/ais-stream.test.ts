import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineSplitter, streamAisMessages } from './ais-stream.js';
import type { Logger } from '../logger.js';

const silentLogger: Logger = { info: () => {}, error: () => {} };
const tokenProvider = { getAccessToken: async () => 'test-token' };

test('line splitter handles a chunk ending mid-line', () => {
  const split = createLineSplitter();
  assert.deepEqual(split('{"a":1}\n{"b"'), ['{"a":1}']);
  assert.deepEqual(split(':2}\n'), ['{"b":2}']);
});

test('line splitter skips empty lines', () => {
  const split = createLineSplitter();
  assert.deepEqual(split('{"a":1}\n\n\n{"b":2}\n'), ['{"a":1}', '{"b":2}']);
});

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

test('yields parsed messages and skips malformed lines', async () => {
  const fetchFn: typeof fetch = async () =>
    streamResponse(['{"mmsi":1}\nnot json\n{"mm', 'si":2}\n']);

  const abort = new AbortController();
  const received: unknown[] = [];
  for await (const msg of streamAisMessages({
    streamUrl: 'https://example.test/stream',
    tokenProvider,
    logger: silentLogger,
    fetchFn,
    signal: abort.signal,
  })) {
    received.push(msg);
    if (received.length === 2) {
      abort.abort();
    }
  }

  assert.deepEqual(received, [{ mmsi: 1 }, { mmsi: 2 }]);
});

test('reconnects after a failed connection attempt', async () => {
  let attempts = 0;
  const fetchFn: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('network down');
    }
    return streamResponse(['{"mmsi":42}\n']);
  };

  const abort = new AbortController();
  const received: unknown[] = [];
  for await (const msg of streamAisMessages({
    streamUrl: 'https://example.test/stream',
    tokenProvider,
    logger: silentLogger,
    fetchFn,
    signal: abort.signal,
    initialBackoffMs: 10,
  })) {
    received.push(msg);
    abort.abort();
  }

  assert.equal(attempts, 2);
  assert.deepEqual(received, [{ mmsi: 42 }]);
});

test('stops when the external signal aborts during backoff', async () => {
  const fetchFn: typeof fetch = async () => {
    throw new Error('always down');
  };

  const abort = new AbortController();
  setTimeout(() => abort.abort(), 30);

  const received: unknown[] = [];
  for await (const msg of streamAisMessages({
    streamUrl: 'https://example.test/stream',
    tokenProvider,
    logger: silentLogger,
    fetchFn,
    signal: abort.signal,
    initialBackoffMs: 10,
    maxBackoffMs: 20,
  })) {
    received.push(msg);
  }

  assert.equal(received.length, 0);
});

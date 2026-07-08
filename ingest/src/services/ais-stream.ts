// Async generator over the Barentswatch live AIS stream (NDJSON).
//
// Behaviour contract:
// - Fetches streamUrl with a fresh token per connection attempt.
// - Splits the byte stream into lines; a chunk may end mid-line, so the
//   partial tail is buffered and prepended to the next chunk.
// - Heartbeat: no data for heartbeatMs => abort and reconnect.
// - Reconnects on stream end / network error / non-2xx with exponential
//   backoff + jitter, reset after a stable connection.
// - Malformed lines are logged and skipped; the generator itself never
//   throws to the consumer while the external signal is active.

import type { Logger } from '../logger.js';

export interface TokenSource {
  getAccessToken(): Promise<string>;
}

export interface AisStreamOptions {
  streamUrl: string;
  tokenProvider: TokenSource;
  logger: Logger;
  fetchFn?: typeof fetch;
  /** Abort to stop the generator permanently (graceful shutdown). */
  signal?: AbortSignal;
  heartbeatMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

const DEFAULT_HEARTBEAT_MS = 60_000;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 60_000;
const STABLE_CONNECTION_MS = 30_000;

/** Stateful newline splitter; keeps a partial trailing line between calls. */
export function createLineSplitter(): (chunk: string) => string[] {
  let tail = '';
  return (chunk: string): string[] => {
    const data = tail + chunk;
    const lines = data.split('\n');
    tail = lines.pop() ?? '';
    return lines.filter((line) => line.trim().length > 0);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* streamAisMessages(options: AisStreamOptions): AsyncGenerator<unknown> {
  const {
    streamUrl,
    tokenProvider,
    logger,
    fetchFn = fetch,
    signal,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  } = options;

  let backoffMs = initialBackoffMs;

  while (!signal?.aborted) {
    const connectedAt = Date.now();
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    let heartbeat: NodeJS.Timeout | undefined;
    const resetHeartbeat = () => {
      clearTimeout(heartbeat);
      heartbeat = setTimeout(() => {
        logger.error('AIS stream heartbeat timeout, reconnecting', undefined, { heartbeatMs });
        controller.abort();
      }, heartbeatMs);
    };

    try {
      const token = await tokenProvider.getAccessToken();
      const response = await fetchFn(streamUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`AIS stream request failed with status ${response.status}`);
      }

      logger.info('AIS stream connected');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const splitLines = createLineSplitter();
      resetHeartbeat();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        resetHeartbeat();

        for (const line of splitLines(decoder.decode(value, { stream: true }))) {
          try {
            yield JSON.parse(line);
          } catch {
            logger.error('Skipping malformed stream line', undefined, { length: line.length });
          }
        }

        if (Date.now() - connectedAt > STABLE_CONNECTION_MS) {
          backoffMs = initialBackoffMs;
        }
      }

      logger.info('AIS stream ended, reconnecting');
    } catch (error) {
      if (!signal?.aborted) {
        logger.error('AIS stream error', error);
      }
    } finally {
      clearTimeout(heartbeat);
      controller.abort();
      signal?.removeEventListener('abort', onExternalAbort);
    }

    if (signal?.aborted) {
      return;
    }

    const jitter = Math.random() * 0.3 * backoffMs;
    await sleep(backoffMs + jitter);
    backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
  }
}

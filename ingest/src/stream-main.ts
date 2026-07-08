// Entry point for the streaming ingest pipeline:
// live AIS stream -> map -> bounding box filter -> batched TimescaleDB writes.

import pg from 'pg';
import { loadEnvFile } from './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { TokenProvider } from './auth/token-provider.js';
import { streamAisMessages } from './services/ais-stream.js';
import { mapMessage } from './mapper.js';
import { inBoundingBox } from './filter.js';
import { TimescaleStore } from './storage/timescale-store.js';

const STATS_INTERVAL_MS = 30_000;

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig();
  const logger = createLogger('marin-ingest');

  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const store = new TimescaleStore({ db: pool, logger });
  store.start();

  const tokenProvider = new TokenProvider(config);
  const abort = new AbortController();

  let received = 0;
  let kept = 0;

  const stats = setInterval(() => {
    logger.info('ingest stats', {
      received,
      kept,
      buffered: store.bufferedCount,
      inserted: store.insertedPositions,
    });
  }, STATS_INTERVAL_MS);
  stats.unref?.();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutting down', { signal });
    abort.abort();
    clearInterval(stats);
    await store.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('Starting AIS stream ingest', {
    boundingBox: config.boundingBox,
    batching: { maxBatchSize: 500, flushIntervalMs: 5000 },
  });

  for await (const raw of streamAisMessages({
    streamUrl: config.streamUrl,
    tokenProvider,
    logger,
    signal: abort.signal,
  })) {
    received += 1;
    const mapped = mapMessage(raw);
    if (!mapped) {
      continue;
    }
    if (!inBoundingBox(mapped.position.latitude, mapped.position.longitude, config.boundingBox)) {
      continue;
    }
    kept += 1;
    store.add(mapped);
  }
}

main().catch((error) => {
  console.error('[marin-ingest] Fatal:', error);
  process.exit(1);
});

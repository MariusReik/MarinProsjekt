import { pathToFileURL } from 'node:url';

import { createApiServer } from './api.js';
import { AISClient } from './services/ais-client.js';
import { createIngestLoop } from './loop.js';
import { createLogger } from './logger.js';
import { JsonFileStore } from './storage/json-file-store.js';

export interface IngestStartupOptions {
  client?: AISClient;
  store?: JsonFileStore;
  logger?: ReturnType<typeof createLogger>;
}

export interface IngestStartupSummary {
  status: 'started';
  service: 'marin-ingest';
  message: string;
  positionsFetched: number;
  storedAt?: string;
}

export async function startIngestService(options: IngestStartupOptions = {}): Promise<IngestStartupSummary> {
  const logger = options.logger ?? createLogger();
  const client = options.client ?? new AISClient();
  const positions = await client.fetchLatestPositions();
  const store = options.store ?? new JsonFileStore();
  const storedAt = await store.save(positions);

  const summary: IngestStartupSummary = {
    status: 'started',
    service: 'marin-ingest',
    message: 'Ingest service connected to Barentswatch and fetched AIS positions.',
    positionsFetched: positions.length,
    storedAt,
  };

  logger.info(summary.message, { positionsFetched: summary.positionsFetched, storedAt });
  return summary;
}

async function main(): Promise<void> {
  const logger = createLogger();
  try {
    await startIngestService({ logger });

    const loop = createIngestLoop({
      intervalMs: 60_000,
      callback: async () => {
        await startIngestService({ logger });
      },
      onError: (error) => {
        logger.error('Ingest cycle failed', error);
      },
    });

    const apiServer = createApiServer();
    apiServer.listen(3000, '127.0.0.1', () => {
      logger.info('HTTP API listening', { port: 3000 });
    });

    loop.start();
  } catch (error) {
    logger.error('Initial ingest startup failed', error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

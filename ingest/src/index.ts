import { pathToFileURL } from 'node:url';

import { AISClient } from './services/ais-client.js';
import { createIngestLoop } from './loop.js';
import { JsonFileStore } from './storage/json-file-store.js';

export interface IngestStartupOptions {
  client?: AISClient;
  store?: JsonFileStore;
}

export interface IngestStartupSummary {
  status: 'started';
  service: 'marin-ingest';
  message: string;
  positionsFetched: number;
  storedAt?: string;
}

export async function startIngestService(options: IngestStartupOptions = {}): Promise<IngestStartupSummary> {
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

  console.info(`[${summary.service}] ${summary.message} (${summary.positionsFetched} positions)`);
  return summary;
}

async function main(): Promise<void> {
  await startIngestService();

  const loop = createIngestLoop({
    intervalMs: 60_000,
    callback: async () => {
      await startIngestService();
    },
  });

  loop.start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

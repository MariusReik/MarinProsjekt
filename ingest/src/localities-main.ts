// Entry point for the Fiskehelse localities refresher (issue #11):
// fetch aquaculture localities -> map/validate -> bounding-box filter ->
// upsert into the localities table. Runs once at startup, then on a slow timer
// (default daily). A failed refresh is logged and retried on the next tick; it
// never crashes the process (brief rule: reconnect/degrade, don't die).

import pg from 'pg';
import { loadEnvFile } from './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { TokenProvider } from './auth/token-provider.js';
import { fetchLocalities } from './services/localities-client.js';
import { mapLocality, type Locality } from './locality-mapper.js';
import { inBoundingBox } from './filter.js';
import { createIngestLoop } from './loop.js';
import { LocalityStore } from './storage/locality-store.js';

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig();
  const logger = createLogger('marin-localities');

  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const store = new LocalityStore({ db: pool, logger });
  // Localities use the bwapi 'api' scope, not the AIS 'ais' scope.
  const tokenProvider = new TokenProvider(config, fetch, config.localitiesScope);

  const refresh = async (): Promise<void> => {
    const token = await tokenProvider.getAccessToken();
    const raw = await fetchLocalities(config.localitiesUrl, token);

    let mapped = 0;
    const localities: Locality[] = [];
    for (const row of raw) {
      const locality = mapLocality(row);
      if (!locality) {
        continue;
      }
      mapped += 1;
      if (!inBoundingBox(locality.latitude, locality.longitude, config.boundingBox)) {
        continue;
      }
      localities.push(locality);
    }

    const written = await store.upsertAll(localities);
    logger.info('Localities refresh complete', {
      received: raw.length,
      mapped,
      inBox: localities.length,
      written,
    });
  };

  const loop = createIngestLoop({
    intervalMs: config.localitiesRefreshMs,
    callback: refresh,
    onError: (error) => logger.error('Localities refresh failed', error),
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutting down', { signal });
    loop.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('Starting localities refresher', {
    endpoint: config.localitiesUrl,
    refreshMs: config.localitiesRefreshMs,
    boundingBox: config.boundingBox,
  });
  loop.start();
}

main().catch((error) => {
  console.error('[marin-localities] Fatal:', error);
  process.exit(1);
});

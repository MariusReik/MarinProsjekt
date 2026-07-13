// Loads and validates environment configuration. Fail fast at startup:
// a missing credential should stop the process with a clear message,
// not surface as a confusing 401 later.

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  streamUrl: string;
  databaseUrl: string;
  boundingBox: BoundingBox;
  // Fiskehelse aquaculture localities (issue #11).
  localitiesUrl: string;
  localitiesScope: string;
  localitiesRefreshMs: number;
}

const DEFAULT_TOKEN_URL = 'https://id.barentswatch.no/connect/token';
const DEFAULT_STREAM_URL =
  'https://live.ais.barentswatch.no/v1/combined?modelType=Full&modelFormat=Json';
// Dev default matches infra/docker-compose.yml. Override in production.
const DEFAULT_DATABASE_URL = 'postgres://marin:marin@localhost:5432/marin';
// Fiskehelse (bwapi) localities list endpoint. Uses OAuth scope 'api', not 'ais'.
const DEFAULT_LOCALITIES_URL =
  'https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/localities';
const DEFAULT_LOCALITIES_SCOPE = 'api';
// Localities change slowly; a daily refresh is plenty (issue #11).
const DEFAULT_LOCALITIES_REFRESH_MS = 24 * 60 * 60 * 1000;

// Decision log 2026-07-07: Vestland county + offshore margin.
const DEFAULT_BBOX: BoundingBox = { minLat: 59.0, maxLat: 62.5, minLon: 3.5, maxLon: 8.0 };

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return value;
}

/**
 * Read config from process.env (see env.ts for .env loading).
 * @throws Error listing every missing variable (not just the first one).
 */
export function loadConfig(): Config {
  const clientId = process.env.BW_CLIENT_ID?.trim();
  const clientSecret = process.env.BW_CLIENT_SECRET?.trim();
  const tokenUrl = process.env.BW_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;
  const streamUrl = process.env.AIS_STREAM_URL?.trim() || DEFAULT_STREAM_URL;
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const localitiesUrl = process.env.LOCALITIES_URL?.trim() || DEFAULT_LOCALITIES_URL;
  const localitiesScope = process.env.LOCALITIES_SCOPE?.trim() || DEFAULT_LOCALITIES_SCOPE;

  const missing = [
    ['BW_CLIENT_ID', clientId],
    ['BW_CLIENT_SECRET', clientSecret],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    const missingNames = missing.map(([name]) => name).join(', ');
    throw new Error(`Missing required configuration: ${missingNames}`);
  }

  const boundingBox: BoundingBox = {
    minLat: numberFromEnv('BBOX_MIN_LAT', DEFAULT_BBOX.minLat),
    maxLat: numberFromEnv('BBOX_MAX_LAT', DEFAULT_BBOX.maxLat),
    minLon: numberFromEnv('BBOX_MIN_LON', DEFAULT_BBOX.minLon),
    maxLon: numberFromEnv('BBOX_MAX_LON', DEFAULT_BBOX.maxLon),
  };

  if (boundingBox.minLat >= boundingBox.maxLat || boundingBox.minLon >= boundingBox.maxLon) {
    throw new Error('Invalid bounding box: min must be strictly less than max');
  }

  const localitiesRefreshMs = numberFromEnv('LOCALITIES_REFRESH_MS', DEFAULT_LOCALITIES_REFRESH_MS);
  if (localitiesRefreshMs <= 0) {
    throw new Error('LOCALITIES_REFRESH_MS must be a positive number of milliseconds');
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    tokenUrl,
    streamUrl,
    databaseUrl,
    boundingBox,
    localitiesUrl,
    localitiesScope,
    localitiesRefreshMs,
  };
}

// Loads and validates environment configuration. Fail fast at startup:
// a missing credential should stop the process with a clear message,
// not surface as a confusing 401 later.

export interface Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
}

const DEFAULT_TOKEN_URL = 'https://id.barentswatch.no/connect/token';

/**
 * Read config from process.env (dotenv is loaded in index.ts).
 * @throws Error listing every missing variable (not just the first one).
 */
export function loadConfig(): Config {
  const clientId = process.env.BW_CLIENT_ID?.trim();
  const clientSecret = process.env.BW_CLIENT_SECRET?.trim();
  const tokenUrl = process.env.BW_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;

  const missing = [
    ['BW_CLIENT_ID', clientId],
    ['BW_CLIENT_SECRET', clientSecret],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    const missingNames = missing.map(([name]) => name).join(', ');
    throw new Error(`Missing required configuration: ${missingNames}`);
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    tokenUrl,
  };
}
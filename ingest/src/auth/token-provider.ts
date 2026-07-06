// Provides a valid Barentswatch access token, caching it in memory.
//
// Behaviour contract:
// 1. First call fetches a token (POST tokenUrl, client_credentials, scope=ais,
//    body form-urlencoded — remember Content-Type header).
// 2. Subsequent calls return the cached token as long as >60s remain
//    of expires_in. One refresh margin constant, not magic numbers.
// 3. Network errors and 5xx: retry with exponential backoff 1s, 2s, 4s
//    (max 3 attempts), then throw.
// 4. 400/401 (invalid_client etc.): throw immediately — retrying a config
//    error just hides it.
// 5. Never log secret or token. Log fetch attempts, expires_in, error status.
// 6. Concurrent callers while a fetch is in flight must share the same
//    promise (no duplicate token requests).

import type { Config } from '../config.js';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const REFRESH_MARGIN_SECONDS = 60;

export class TokenProvider {
  private cachedToken: string | null = null;
  private expiresAt: number | null = null;
  private inFlightPromise: Promise<string> | null = null;

  constructor(
    private readonly config: Config,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** Returns a currently-valid access token, fetching/refreshing as needed. */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.expiresAt && now < this.expiresAt - REFRESH_MARGIN_SECONDS * 1000) {
      return this.cachedToken;
    }

    if (!this.inFlightPromise) {
      this.inFlightPromise = this.fetchToken().finally(() => {
        this.inFlightPromise = null;
      });
    }

    return this.inFlightPromise;
  }

  private async fetchToken(): Promise<string> {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'ais',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const attempts = [1000, 2000, 4000];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= attempts.length; attempt += 1) {
      try {
        const response = await this.fetchFn(this.config.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });

        if (response.status === 400 || response.status === 401) {
          throw new Error(`Token request rejected with status ${response.status}`);
        }

        if (!response.ok) {
          throw new Error(`Token request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as TokenResponse;
        const expiresIn = Number(payload.expires_in ?? 0);
        this.cachedToken = payload.access_token;
        this.expiresAt = Date.now() + Math.max(expiresIn, 0) * 1000;
        return this.cachedToken;
      } catch (error) {
        lastError = error as Error;
        if (attempt === attempts.length) {
          throw lastError;
        }

        await new Promise((resolve) => setTimeout(resolve, attempts[attempt]));
      }
    }

    throw lastError ?? new Error('Token request failed');
  }
}
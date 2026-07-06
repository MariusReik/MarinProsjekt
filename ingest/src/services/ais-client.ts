import { loadConfig, type Config } from '../config.js';
import { TokenProvider } from '../auth/token-provider.js';
import { fetchBarentswatchPositions, type AISPosition } from './barentswatch.js';

export interface AISClientOptions {
  endpoint?: string;
  tokenProvider?: TokenProvider;
  config?: Config;
}

export class AISClient {
  private readonly endpoint: string;
  private readonly tokenProvider: TokenProvider;

  constructor(options: AISClientOptions = {}) {
    const config = options.config ?? loadConfig();
    this.endpoint = options.endpoint ?? 'https://live.ais.barentswatch.no/v1/latest/combined';
    this.tokenProvider = options.tokenProvider ?? new TokenProvider(config);
  }

  async fetchLatestPositions(): Promise<AISPosition[]> {
    const token = await this.tokenProvider.getAccessToken();
    const positions = await fetchBarentswatchPositions(this.endpoint, token);
    return positions.filter(isValidPosition);
  }
}

export function isValidPosition(position: AISPosition): boolean {
  return Number.isFinite(position.latitude) && Number.isFinite(position.longitude) && Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180;
}

import type { AISPosition } from '../services/barentswatch.js';
import type { PositionStore } from './storage.js';

export interface PostgresStoreOptions {
  client: {
    query(text: string, values?: unknown[]): Promise<{ rows?: Array<Record<string, unknown>>; rowCount?: number }>;
  };
}

export class PostgresPositionStore implements PositionStore {
  constructor(private readonly options: PostgresStoreOptions) {}

  async save(positions: AISPosition[]): Promise<string> {
    await this.ensureTable();
    await this.options.client.query('DELETE FROM ais_positions');
    await this.options.client.query('INSERT INTO ais_positions (payload) VALUES ($1)', [JSON.stringify(positions)]);
    return 'postgres';
  }

  async load(): Promise<AISPosition[]> {
    await this.ensureTable();
    const result = await this.options.client.query('SELECT payload FROM ais_positions ORDER BY id DESC LIMIT 1');
    const payload = result.rows?.[0]?.payload;
    if (typeof payload === 'string') {
      return JSON.parse(payload) as AISPosition[];
    }
    return [];
  }

  private async ensureTable(): Promise<void> {
    await this.options.client.query(`
      CREATE TABLE IF NOT EXISTS ais_positions (
        id SERIAL PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
}

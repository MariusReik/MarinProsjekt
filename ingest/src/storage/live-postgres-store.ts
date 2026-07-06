import { Pool } from 'pg';

import type { AISPosition } from '../services/barentswatch.js';
import type { PositionStore } from './storage.js';

export interface LivePostgresStoreOptions {
  connectionString?: string;
  pool?: Pool;
}

export class LivePostgresStore implements PositionStore {
  private readonly pool: Pool;

  constructor(options: LivePostgresStoreOptions = {}) {
    this.pool = options.pool ?? new Pool({ connectionString: options.connectionString ?? process.env.DATABASE_URL });
  }

  async save(positions: AISPosition[]): Promise<string> {
    await this.ensureTable();
    await this.pool.query('DELETE FROM ais_positions');
    await this.pool.query('INSERT INTO ais_positions (payload) VALUES ($1)', [JSON.stringify(positions)]);
    return 'postgres';
  }

  async load(): Promise<AISPosition[]> {
    await this.ensureTable();
    const result = await this.pool.query('SELECT payload FROM ais_positions ORDER BY id DESC LIMIT 1');
    const payload = result.rows[0]?.payload;
    if (typeof payload === 'string') {
      return JSON.parse(payload) as AISPosition[];
    }
    return [];
  }

  async ensureTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ais_positions (
        id SERIAL PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
}

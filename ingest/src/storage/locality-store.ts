// Upserts aquaculture localities into the `localities` table.
//
// Localities are a small, slowly-changing reference set, so each refresh does a
// full upsert keyed on the natural locality_no: existing rows are updated in
// place (name/coordinates/updated_at), new ones inserted. The generated `geom`
// column is maintained by Postgres, so it is never written here. Rows are
// chunked to stay well under Postgres' parameter limit even if the box ever
// contains thousands of localities.

import type { Locality } from '../locality-mapper.js';
import type { Logger } from '../logger.js';

/** Structural subset of pg.Pool, injectable for tests. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

export interface LocalityStoreOptions {
  db: Queryable;
  logger: Logger;
  chunkSize?: number;
}

const COLUMNS_PER_ROW = 4;
const DEFAULT_CHUNK_SIZE = 500;

export class LocalityStore {
  private readonly db: Queryable;
  private readonly logger: Logger;
  private readonly chunkSize: number;

  constructor(options: LocalityStoreOptions) {
    this.db = options.db;
    this.logger = options.logger;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  /**
   * Upsert every locality. Returns the number of rows written. A DB error
   * propagates to the caller (the refresh job logs it and keeps running) rather
   * than being swallowed here.
   */
  async upsertAll(localities: Locality[]): Promise<number> {
    if (localities.length === 0) {
      this.logger.info('No localities to upsert');
      return 0;
    }

    let written = 0;
    for (let i = 0; i < localities.length; i += this.chunkSize) {
      const chunk = localities.slice(i, i + this.chunkSize);
      written += await this.upsertChunk(chunk);
    }
    return written;
  }

  private async upsertChunk(chunk: Locality[]): Promise<number> {
    const values: unknown[] = [];
    const rows = chunk.map((locality, index) => {
      values.push(locality.localityNo, locality.name, locality.latitude, locality.longitude);
      const base = index * COLUMNS_PER_ROW;
      const placeholders = Array.from({ length: COLUMNS_PER_ROW }, (_, i) => `$${base + i + 1}`);
      return `(${placeholders.join(',')})`;
    });

    const result = await this.db.query(
      `INSERT INTO localities (locality_no, name, latitude, longitude)
       VALUES ${rows.join(',')}
       ON CONFLICT (locality_no) DO UPDATE SET
         name = EXCLUDED.name,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         updated_at = NOW()`,
      values,
    );
    return result.rowCount ?? chunk.length;
  }
}

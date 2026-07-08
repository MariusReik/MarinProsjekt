// Batching writer for AIS positions + vessel metadata against TimescaleDB.
//
// Behaviour contract:
// - add() buffers; a flush runs when the buffer reaches maxBatchSize or every
//   flushIntervalMs, whichever comes first.
// - Positions: INSERT ... ON CONFLICT (mmsi, msgtime) DO NOTHING — the natural
//   PK dedups reconnect replays (decision log 2026-07-07).
// - Vessels: one upsert per distinct mmsi in the batch (latest message wins).
// - A failed flush logs and re-buffers the batch; it never crashes the
//   pipeline (brief rule). The buffer is capped so a long DB outage degrades
//   to dropping oldest data instead of exhausting memory.

import type { Logger } from '../logger.js';
import type { MappedMessage } from '../mapper.js';

/** Structural subset of pg.Pool, injectable for tests. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

export interface TimescaleStoreOptions {
  db: Queryable;
  logger: Logger;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

const DEFAULT_MAX_BATCH_SIZE = 500;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_BUFFER_SIZE = 10_000;

export class TimescaleStore {
  private readonly db: Queryable;
  private readonly logger: Logger;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;

  private buffer: MappedMessage[] = [];
  private timer: NodeJS.Timeout | undefined;
  private flushing = false;
  private closed = false;

  /** Total positions successfully written, for stats logging. */
  insertedPositions = 0;

  constructor(options: TimescaleStoreOptions) {
    this.db = options.db;
    this.logger = options.logger;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
  }

  get bufferedCount(): number {
    return this.buffer.length;
  }

  start(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.timer.unref?.();
  }

  add(entry: MappedMessage): void {
    if (this.closed) {
      return;
    }
    this.buffer.push(entry);

    if (this.buffer.length > this.maxBufferSize) {
      const dropped = this.buffer.length - this.maxBufferSize;
      this.buffer.splice(0, dropped);
      this.logger.error('Store buffer overflow, dropping oldest entries', undefined, { dropped });
    }

    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }
    this.flushing = true;
    const batch = this.buffer.splice(0, this.maxBatchSize);
    try {
      await this.insertPositions(batch);
      await this.upsertVessels(batch);
      this.insertedPositions += batch.length;
    } catch (error) {
      this.logger.error('Flush failed, batch re-buffered for retry', error, {
        batchSize: batch.length,
      });
      this.buffer.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  /** Stops the timer and attempts one final flush. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.flush();
    if (this.buffer.length > 0) {
      this.logger.error('Closing with unflushed entries', undefined, {
        remaining: this.buffer.length,
      });
    }
  }

  private async insertPositions(batch: MappedMessage[]): Promise<void> {
    const columns = 9;
    const values: unknown[] = [];
    const rows = batch.map((entry, index) => {
      const p = entry.position;
      values.push(
        p.mmsi,
        p.msgtime,
        p.latitude,
        p.longitude,
        p.sog,
        p.cog,
        p.trueHeading,
        p.rateOfTurn,
        p.navStatus,
      );
      const base = index * columns;
      const placeholders = Array.from({ length: columns }, (_, i) => `$${base + i + 1}`);
      return `(${placeholders.join(',')})`;
    });

    await this.db.query(
      `INSERT INTO ais_positions
         (mmsi, msgtime, latitude, longitude, sog, cog, true_heading, rate_of_turn, nav_status)
       VALUES ${rows.join(',')}
       ON CONFLICT (mmsi, msgtime) DO NOTHING`,
      values,
    );
  }

  private async upsertVessels(batch: MappedMessage[]): Promise<void> {
    // Deduplicate by mmsi, keeping the latest observation in the batch.
    const byMmsi = new Map<number, MappedMessage['vessel']>();
    for (const entry of batch) {
      const existing = byMmsi.get(entry.vessel.mmsi);
      if (!existing || entry.vessel.lastSeen > existing.lastSeen) {
        byMmsi.set(entry.vessel.mmsi, entry.vessel);
      }
    }

    const vessels = [...byMmsi.values()];
    const columns = 4;
    const values: unknown[] = [];
    const rows = vessels.map((vessel, index) => {
      values.push(vessel.mmsi, vessel.name, vessel.shipType, vessel.lastSeen);
      const base = index * columns;
      const placeholders = Array.from({ length: columns }, (_, i) => `$${base + i + 1}`);
      return `(${placeholders.join(',')})`;
    });

    await this.db.query(
      `INSERT INTO vessels (mmsi, name, ship_type, last_seen)
       VALUES ${rows.join(',')}
       ON CONFLICT (mmsi) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, vessels.name),
         ship_type = COALESCE(EXCLUDED.ship_type, vessels.ship_type),
         last_seen = GREATEST(vessels.last_seen, EXCLUDED.last_seen)`,
      values,
    );
  }
}

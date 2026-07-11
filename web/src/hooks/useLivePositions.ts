import { useEffect, useRef, useState } from "react";
import type { Position, Vessel } from "../api/types";
import { fetchLatestPositions, fetchVessels } from "../api/client";
import { connectPositionStream, type ConnectionStatus } from "../api/positionStream";
import { VESSEL_STALE_AFTER_MS } from "../config";

export interface LivePositions {
  /**
   * Latest known position per MMSI. A ref (not state) so high-frequency
   * WebSocket updates don't trigger a React re-render per frame — the map
   * reads this on its own throttled interval.
   */
  store: React.MutableRefObject<Map<number, Position>>;
  /** MMSI -> vessel name lookup, fetched once for the info panel. */
  vesselNames: Map<number, string>;
  status: ConnectionStatus;
  /** Non-fatal load error (initial snapshot / vessel list), if any. */
  error: string | null;
}

/**
 * Owns the live vessel position store: seeds it with a REST snapshot, then
 * keeps it current from the STOMP stream (#8), upserting by MMSI and keeping
 * only the newest observation per vessel. Stale vessels are pruned lazily on
 * each incoming batch.
 */
export function useLivePositions(): LivePositions {
  const store = useRef<Map<number, Position>>(new Map());
  const [vesselNames, setVesselNames] = useState<Map<number, string>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Seed with the latest snapshot so the map isn't empty until the first
    // broadcast arrives. Failure here is non-fatal — the live stream will
    // still populate the map.
    fetchLatestPositions(controller.signal)
      .then((positions) => {
        for (const p of positions) {
          upsert(store.current, p);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(`Kunne ikke hente startposisjoner: ${errMessage(err)}`);
        }
      });

    fetchVessels(controller.signal)
      .then((vessels: Vessel[]) => {
        const names = new Map<number, string>();
        for (const v of vessels) {
          if (v.name) {
            names.set(v.mmsi, v.name);
          }
        }
        setVesselNames(names);
      })
      .catch(() => {
        // Names are a nice-to-have; the map works with raw MMSI without them.
      });

    const disconnect = connectPositionStream({
      onStatusChange: setStatus,
      onPositions: (positions) => {
        for (const p of positions) {
          upsert(store.current, p);
        }
        pruneStale(store.current);
      },
    });

    return () => {
      controller.abort();
      disconnect();
    };
  }, []);

  return { store, vesselNames, status, error };
}

/** Keep the newest observation per MMSI (msgtime is ISO-8601, sortable). */
function upsert(store: Map<number, Position>, p: Position): void {
  const existing = store.get(p.mmsi);
  if (!existing || p.msgtime > existing.msgtime) {
    store.set(p.mmsi, p);
  }
}

function pruneStale(store: Map<number, Position>): void {
  const cutoff = Date.now() - VESSEL_STALE_AFTER_MS;
  for (const [mmsi, p] of store) {
    if (Date.parse(p.msgtime) < cutoff) {
      store.delete(mmsi);
    }
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

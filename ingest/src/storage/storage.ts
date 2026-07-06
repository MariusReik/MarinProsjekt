import type { AISPosition } from '../services/barentswatch.js';

export interface PositionStore {
  save(positions: AISPosition[]): Promise<string>;
  load(): Promise<AISPosition[]>;
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { AISPosition } from '../services/barentswatch.js';
import type { PositionStore } from './storage.js';

export interface JsonFileStoreOptions {
  outputPath?: string;
}

export class JsonFileStore implements PositionStore {
  constructor(private readonly options: JsonFileStoreOptions = {}) {}

  async save(positions: AISPosition[]): Promise<string> {
    const outputPath = resolve(this.options.outputPath ?? 'data/latest-positions.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(positions, null, 2), 'utf8');
    return outputPath;
  }

  async load(): Promise<AISPosition[]> {
    const outputPath = resolve(this.options.outputPath ?? 'data/latest-positions.json');
    try {
      const contents = await readFile(outputPath, 'utf8');
      return JSON.parse(contents) as AISPosition[];
    } catch {
      return [];
    }
  }
}

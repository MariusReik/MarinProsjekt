import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { AISPosition } from '../services/barentswatch.js';

export interface JsonFileStoreOptions {
  outputPath?: string;
}

export class JsonFileStore {
  constructor(private readonly options: JsonFileStoreOptions = {}) {}

  async save(positions: AISPosition[]): Promise<string> {
    const outputPath = resolve(this.options.outputPath ?? 'data/latest-positions.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(positions, null, 2), 'utf8');
    return outputPath;
  }
}

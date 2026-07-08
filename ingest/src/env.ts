// Minimal .env loader (KEY=VALUE lines, no dependency on dotenv).
// Existing process.env values always win so CI/production can override.
import { readFileSync } from 'node:fs';

export function loadEnvFile(path = '.env'): void {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return; // no .env file is fine (e.g. in CI)
  }

  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

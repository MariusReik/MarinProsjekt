import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { JsonFileStore } from './storage/json-file-store.js';
import type { PositionStore } from './storage/storage.js';

export function createApiServer(store: PositionStore = new JsonFileStore()) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.url === '/positions') {
      const positions = await store.load();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(positions));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

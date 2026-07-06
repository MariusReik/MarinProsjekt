export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
}

export function createLogger(prefix = 'marin-ingest'): Logger {
  return {
    info(message, meta) {
      const details = meta ? ` ${JSON.stringify(meta)}` : '';
      console.info(`[${prefix}] ${message}${details}`);
    },
    error(message, error, meta) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      const details = meta ? ` ${JSON.stringify(meta)}` : '';
      console.error(`[${prefix}] ${message}: ${errorDetails}${details}`);
    },
  };
}

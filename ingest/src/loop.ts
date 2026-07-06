export interface IngestLoopOptions {
  intervalMs: number;
  callback: () => Promise<void> | void;
}

export interface IngestLoop {
  start(): void;
  stop(): void;
}

export function createIngestLoop(options: IngestLoopOptions): IngestLoop {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const run = async () => {
    if (!running) {
      return;
    }

    await options.callback();

    if (running) {
      timer = setTimeout(() => {
        void run();
      }, options.intervalMs);
    }
  };

  return {
    start() {
      if (running) {
        return;
      }

      running = true;
      void run();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

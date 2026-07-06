export interface IngestLoopOptions {
  intervalMs: number;
  callback: () => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export interface IngestLoop {
  start(): void;
  stop(): void;
}

export function createIngestLoop(options: IngestLoopOptions): IngestLoop {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const scheduleNext = () => {
    if (!running) {
      return;
    }

    timer = setTimeout(() => {
      void run();
    }, options.intervalMs);
  };

  const run = async () => {
    if (!running) {
      return;
    }

    try {
      await options.callback();
    } catch (error) {
      options.onError?.(error);
    } finally {
      if (running) {
        scheduleNext();
      }
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

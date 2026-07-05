import { pathToFileURL } from 'node:url';

export interface IngestStartupSummary {
  status: 'started';
  service: 'marin-ingest';
  message: string;
}

export function startIngestService(): IngestStartupSummary {
  const summary: IngestStartupSummary = {
    status: 'started',
    service: 'marin-ingest',
    message: 'Ingest service scaffold is ready for future integration work.',
  };

  console.info(`[${summary.service}] ${summary.message}`);
  return summary;
}

function main(): void {
  startIngestService();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

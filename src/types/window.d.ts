import type { MettriBridgeClient } from '../content/bridge-client';
import type { LocalBatchExporter } from '../infrastructure/local-batch-exporter';

declare global {
  interface Window {
    MettriBridge?: MettriBridgeClient;
    MettriExporter?: LocalBatchExporter;
  }
}

export {};


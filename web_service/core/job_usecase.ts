/**
 * Abstract base for Job Use Cases
 * Provides common functionality for job-related operations
 */

import { ProcessBase, ProcessLogEntry, ProcessResult } from './process_base.ts';

/** Job UseCase configuration */
export interface JobUsecaseConfig {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Batch size for operations */
  batchSize?: number;
  /** Delay between operations (ms) */
  delayMs?: number;
}

/** Abstract base class for job use cases */
export abstract class JobUsecaseBase extends ProcessBase {
  protected config: Required<JobUsecaseConfig>;

  constructor(
    id: string,
    name: string,
    icon: string,
    description: string,
    config: JobUsecaseConfig = {}
  ) {
    super(id, name, icon, description);
    
    this.config = {
      verbose: config.verbose ?? true,
      batchSize: config.batchSize ?? 100,
      delayMs: config.delayMs ?? 100,
    };
  }

  /** Sleep utility */
  protected async sleep(seconds: number): Promise<void> {
    this.logInfo(`Sleeping for ${seconds} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /** Execute with batch processing support */
  protected async executeBatched<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    itemName: string = 'item'
  ): Promise<void> {
    const total = items.length;
    this.logInfo(`Processing ${total} ${itemName}s in batches of ${this.config.batchSize}`);

    for (let i = 0; i < total; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);
      const batchNum = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(total / this.config.batchSize);

      this.logInfo(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ${itemName}s)`);

      for (const item of batch) {
        await processor(item);
      }

      if (this.config.delayMs > 0 && i + this.config.batchSize < total) {
        await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
      }
    }

    this.logSuccess(`Processed ${total} ${itemName}s`);
  }

  /** Wrap an async operation with logging */
  protected async wrapOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.logInfo(`Starting: ${operationName}`);
    try {
      const result = await operation();
      this.logSuccess(`Completed: ${operationName}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logError(`Failed: ${operationName} - ${message}`);
      throw error;
    }
  }
}

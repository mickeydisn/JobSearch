/**
 * Process Manager - Singleton to manage all registered processes
 * Runs all processes directly in the main thread to avoid SQLite concurrency issues
 */

import { ProcessBase, ProcessDefinition, ProcessResult } from './process_base.ts';

/** Process constructor type */
export type ProcessConstructor = new () => ProcessBase;

/** Process execution options */
export interface ProcessOptions {
  /** Specific scraper to run (for scrap job) */
  scraperName?: string;
}

/** Process registry entry */
interface ProcessRegistryEntry {
  constructor: ProcessConstructor;
  instance?: ProcessBase;
}

/** Worker info - now just tracks running processes */
interface ProcessInfo {
  startTime: Date;
}

/** Process Manager - manages all available processes */
export class ProcessManager {
  private static instance: ProcessManager;
  private registry: Map<string, ProcessRegistryEntry> = new Map();
  private activeProcesses: Map<string, ProcessInfo> = new Map();

  private constructor() {}

  /** Get singleton instance */
  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  /** Check if a process is currently running */
  isProcessRunning(processId: string): boolean {
    return this.activeProcesses.has(processId);
  }

  /** Kill a running process (no-op for direct execution, process can't be force-killed) */
  killProcess(processId: string): boolean {
    const processInfo = this.activeProcesses.get(processId);
    if (processInfo) {
      // For direct execution, we can't truly kill the process
      // The abort controller would need to be implemented in the use case
      this.activeProcesses.delete(processId);
      return true;
    }
    return false;
  }

  /** Register a process */
  register(processConstructor: ProcessConstructor): void {
    // Create a temporary instance to get the ID
    const tempInstance = new processConstructor();
    const id = tempInstance.id;

    this.registry.set(id, {
      constructor: processConstructor,
    });
  }

  /** Get all registered process definitions */
  getProcessDefinitions(): ProcessDefinition[] {
    const definitions: ProcessDefinition[] = [];

    for (const [, entry] of this.registry) {
      const instance = new entry.constructor();
      definitions.push(instance.getDefinition());
    }

    return definitions;
  }

  /** Get a specific process instance (creates new each time) */
  getProcess(id: string, options?: ProcessOptions): ProcessBase | undefined {
    const entry = this.registry.get(id);
    if (!entry) return undefined;

    const process = new entry.constructor();
    
    // Apply options for ScrapJobsUsecase
    if (id === 'scrap' && options?.scraperName && 'setSpecificScraper' in process) {
      (process as any).setSpecificScraper(options.scraperName);
    }
    
    return process;
  }

  /** Check if process exists */
  hasProcess(id: string): boolean {
    return this.registry.has(id);
  }

  /** Run a process by ID (non-streaming, returns final result) */
  async runProcess(id: string, options?: ProcessOptions): Promise<ProcessResult> {
    const process = this.getProcess(id, options);

    if (!process) {
      return {
        success: false,
        output: '',
        error: `Process '${id}' not found`,
        logs: [],
        durationMs: 0,
      };
    }

    return await process.run();
  }

  /** Create an SSE stream for a process - runs directly without Web Workers */
  createProcessStream(processId: string, options?: ProcessOptions): ReadableStream<Uint8Array> {
    const self = this;

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial message
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'start', message: 'Process starting...' })}\n\n`
        ));

        // Handle individual scraper execution (format: "scrap:hellowork")
        let actualProcessId = processId;
        let processOptions: ProcessOptions | undefined = options;
        
        if (processId.startsWith('scrap:')) {
          actualProcessId = 'scrap';
          const scraperName = processId.split(':')[1];
          processOptions = { ...options, scraperName };
        }

        // Get process definition
        const process = self.getProcess(actualProcessId, processOptions);
        if (!process) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: `Process '${processId}' not found` })}\n\n`
          ));
          controller.close();
          return;
        }

        // Run all processes directly to avoid SQLite concurrency issues
        // Both 'scrap' and 'update' run in the main thread with shared DB connection
        switch (actualProcessId) {
          case 'scrap':
          case 'update':
            await self.runProcessDirect(actualProcessId, controller, encoder, processOptions);
            return;
          default:
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: `Process '${processId}' not found or not supported` })}\n\n`
            ));
            controller.close();
            return;
        }
      },

      cancel() {
        // Clean up if stream is cancelled
        self.killProcess(processId);
      }
    });
  }

  /** Close an active stream */
  closeStream(processId: string): void {
    this.killProcess(processId);
  }

  /** Run a process directly without a Web Worker (avoids SQLite concurrency issues) */
  private async runProcessDirect(
    processId: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    options?: ProcessOptions
  ): Promise<void> {
    const startTime = new Date();
    this.activeProcesses.set(processId, { startTime });

    try {
      const process = this.getProcess(processId, options);
      if (!process) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: `Process '${processId}' not found` })}\n\n`
        ));
        controller.close();
        return;
      }

      // Set up log streaming
      process.setLogCallback((entry) => {
        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'log',
              level: entry.level,
              message: entry.message,
              timestamp: entry.timestamp.toISOString()
            })}\n\n`
          ));
        } catch {
          // Stream may be closed
        }
      });

      const result = await process.run();

      if (result.success) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'complete',
            durationMs: result.durationMs,
            message: 'Process completed successfully'
          })}\n\n`
        ));
      } else {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            message: result.error || 'Process failed'
          })}\n\n`
        ));
      }
      controller.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'error', message })}\n\n`
      ));
      controller.close();
    } finally {
      this.activeProcesses.delete(processId);
    }
  }
}

/** Global process manager instance */
export const processManager = ProcessManager.getInstance();

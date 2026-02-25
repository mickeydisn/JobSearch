/**
 * Abstract base class for all processes
 * Provides common functionality for process execution, logging, and status tracking
 */

/** Process status */
export type ProcessStatus = 'idle' | 'running' | 'success' | 'error';

/** Process log entry */
export interface ProcessLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

/** Process result */
export interface ProcessResult {
  success: boolean;
  output: string;
  error?: string;
  logs: ProcessLogEntry[];
  durationMs: number;
}

/** Process definition */
export interface ProcessDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/** Log callback type for streaming */
export type LogCallback = (entry: ProcessLogEntry) => void;

/** Abstract base class for all processes */
export abstract class ProcessBase {
  protected logs: ProcessLogEntry[] = [];
  protected status: ProcessStatus = 'idle';
  protected startTime: Date | null = null;
  protected logCallback?: LogCallback;
  // Store original console.log to avoid infinite loops when overriding
  protected originalConsoleLog: typeof console.log = console.log;
  // Abort controller for cancelling the process
  protected abortController?: AbortController;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly icon: string,
    public readonly description: string
  ) {}

  /** Set abort controller for cancellation support */
  setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  /** Check if process has been cancelled */
  protected isCancelled(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  /** Throw if cancelled */
  protected checkCancelled(): void {
    if (this.isCancelled()) {
      throw new Error('Process cancelled by user');
    }
  }

  /** Set callback for real-time log streaming */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }

  /** Get process definition for UI */
  getDefinition(): ProcessDefinition {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      description: this.description,
    };
  }

  /** Get current status */
  getStatus(): ProcessStatus {
    return this.status;
  }

  /** Get logs */
  getLogs(): ProcessLogEntry[] {
    return [...this.logs];
  }

  /** Log a message */
  protected log(level: ProcessLogEntry['level'], message: string): void {
    const entry: ProcessLogEntry = {
      timestamp: new Date(),
      level,
      message,
    };
    this.logs.push(entry);
    
    // Stream log to callback if set
    if (this.logCallback) {
      this.logCallback(entry);
    }
    
    // Use original console.log to avoid infinite loops when console is overridden
    this.originalConsoleLog(`[${level.toUpperCase()}] ${message}`);
  }

  protected logInfo(message: string): void {
    this.log('info', message);
  }

  protected logWarn(message: string): void {
    this.log('warn', message);
  }

  protected logError(message: string): void {
    this.log('error', message);
  }

  protected logSuccess(message: string): void {
    this.log('success', message);
  }

  /** Clear logs and reset status */
  protected reset(): void {
    this.logs = [];
    this.status = 'idle';
    this.startTime = null;
  }

  /** Execute the process - must be implemented by subclasses */
  abstract execute(): Promise<void>;

  /** Run the process with error handling and logging */
  async run(): Promise<ProcessResult> {
    this.reset();
    this.status = 'running';
    this.startTime = new Date();

    this.logInfo(`Starting process: ${this.name}`);

    // Store original console methods
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    // Override console methods to capture output
    console.log = (...args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      this.logInfo(message);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      this.logError(message);
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      this.logWarn(message);
      originalConsoleWarn.apply(console, args);
    };

    console.info = (...args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      this.logInfo(message);
      originalConsoleInfo.apply(console, args);
    };

    try {
      await this.execute();
      this.status = 'success';
      this.logSuccess(`Process completed successfully`);
    } catch (error) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Process failed: ${errorMessage}`);
    } finally {
      // Restore original console methods
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    }

    const durationMs = this.startTime 
      ? new Date().getTime() - this.startTime.getTime() 
      : 0;

    return {
      success: this.status === 'success',
      output: this.formatLogs(),
      error: this.status === 'error' ? this.getLastError() : undefined,
      logs: this.getLogs(),
      durationMs,
    };
  }

  /** Format logs as string output */
  protected formatLogs(): string {
    return this.logs
      .map((log) => {
        const time = log.timestamp.toLocaleTimeString();
        const level = log.level.toUpperCase().padEnd(7);
        return `[${time}] ${level} ${log.message}`;
      })
      .join('\n');
  }

  /** Get last error message */
  protected getLastError(): string | undefined {
    const errorLog = this.logs.find((log) => log.level === 'error');
    return errorLog?.message;
  }
}

import type { Logger } from '@src/core/ports/logger';

export class ConsoleLogger implements Logger {
  debug(message: string, data?: unknown): void {
    console.debug(`[DEBUG] ${message}`, data);
  }

  info(message: string, data?: unknown): void {
    console.info(`[INFO] ${message}`, data);
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[WARN] ${message}`, data);
  }

  error(message: string, data?: unknown): void {
    console.error(`[ERROR] ${message}`, data);
  }
}

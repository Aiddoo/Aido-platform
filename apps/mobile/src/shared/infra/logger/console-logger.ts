import type { LogContext, AppLogger, LogLevel } from '@src/core/ports/app-logger';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface ConsoleLoggerOptions {
  minLevel: LogLevel;
}

export function createConsoleLogger({ minLevel }: ConsoleLoggerOptions): AppLogger {
  const shouldLog = (level: LogLevel): boolean =>
    LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];

  return {
    debug: (message: string, context?: LogContext): void => {
      if (!shouldLog('debug')) {
        return;
      }
      if (context) {
        console.debug(`[DEBUG] ${message}`, context);
        return;
      }
      console.debug(`[DEBUG] ${message}`);
    },
    info: (message: string, context?: LogContext): void => {
      if (!shouldLog('info')) {
        return;
      }
      if (context) {
        console.info(`[INFO] ${message}`, context);
        return;
      }
      console.info(`[INFO] ${message}`);
    },
    warn: (message: string, context?: LogContext): void => {
      if (!shouldLog('warn')) {
        return;
      }
      if (context) {
        console.warn(`[WARN] ${message}`, context);
        return;
      }
      console.warn(`[WARN] ${message}`);
    },
    error: (message: string, error?: Error, context?: LogContext): void => {
      if (!shouldLog('error')) {
        return;
      }
      if (error && context) {
        console.error(`[ERROR] ${message}`, error, context);
      } else if (error) {
        console.error(`[ERROR] ${message}`, error);
      } else if (context) {
        console.error(`[ERROR] ${message}`, context);
      } else {
        console.error(`[ERROR] ${message}`);
      }
    },
  };
}

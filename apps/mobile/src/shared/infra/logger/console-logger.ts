import type { LogContext, Logger, LogLevel } from '@src/core/ports/logger';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface ConsoleLoggerOptions {
  minLevel: LogLevel;
}

export const createConsoleLogger = ({ minLevel }: ConsoleLoggerOptions): Logger => {
  const shouldLog = (level: LogLevel): boolean =>
    LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];

  return {
    debug(message: string, context?: LogContext): void {
      if (!shouldLog('debug')) return;
      console.debug(`[DEBUG] ${message}`, context ?? '');
    },
    info(message: string, context?: LogContext): void {
      if (!shouldLog('info')) return;
      console.info(`[INFO] ${message}`, context ?? '');
    },
    warn(message: string, context?: LogContext): void {
      if (!shouldLog('warn')) return;
      console.warn(`[WARN] ${message}`, context ?? '');
    },
    error(message: string, error?: Error, context?: LogContext): void {
      if (!shouldLog('error')) return;
      console.error(`[ERROR] ${message}`, error ?? '', context ?? '');
    },
  };
};

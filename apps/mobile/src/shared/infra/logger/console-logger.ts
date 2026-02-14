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
      context ? console.debug(`[DEBUG] ${message}`, context) : console.debug(`[DEBUG] ${message}`);
    },
    info(message: string, context?: LogContext): void {
      if (!shouldLog('info')) return;
      context ? console.info(`[INFO] ${message}`, context) : console.info(`[INFO] ${message}`);
    },
    warn(message: string, context?: LogContext): void {
      if (!shouldLog('warn')) return;
      context ? console.warn(`[WARN] ${message}`, context) : console.warn(`[WARN] ${message}`);
    },
    error(message: string, error?: Error, context?: LogContext): void {
      if (!shouldLog('error')) return;
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
};

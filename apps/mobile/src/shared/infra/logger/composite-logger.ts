import type { LogContext, AppLogger } from '@src/core/ports/app-logger';

export function createCompositeLogger(loggers: AppLogger[]): AppLogger {
  function forEachLogger(write: (logger: AppLogger) => void): void {
    for (const logger of loggers) {
      try {
        write(logger);
      } catch (error) {
        if (__DEV__) {
          console.warn('[CompositeLogger] failed:', error);
        }
      }
    }
  }

  return {
    debug: (message: string, context?: LogContext): void => {
      forEachLogger((logger) => logger.debug(message, context));
    },
    info: (message: string, context?: LogContext): void => {
      forEachLogger((logger) => logger.info(message, context));
    },
    warn: (message: string, context?: LogContext): void => {
      forEachLogger((logger) => logger.warn(message, context));
    },
    error: (message: string, error?: Error, context?: LogContext): void => {
      forEachLogger((logger) => logger.error(message, error, context));
    },
  };
}

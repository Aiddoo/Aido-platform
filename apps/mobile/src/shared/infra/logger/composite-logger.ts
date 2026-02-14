import type { LogContext, Logger } from '@src/core/ports/logger';

export const createCompositeLogger = (loggers: Logger[]): Logger => ({
  debug(message: string, context?: LogContext): void {
    for (const logger of loggers) {
      try {
        logger.debug(message, context);
      } catch {}
    }
  },
  info(message: string, context?: LogContext): void {
    for (const logger of loggers) {
      try {
        logger.info(message, context);
      } catch {}
    }
  },
  warn(message: string, context?: LogContext): void {
    for (const logger of loggers) {
      try {
        logger.warn(message, context);
      } catch {}
    }
  },
  error(message: string, error?: Error, context?: LogContext): void {
    for (const logger of loggers) {
      try {
        logger.error(message, error, context);
      } catch {}
    }
  },
});

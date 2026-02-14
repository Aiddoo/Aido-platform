import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

export const createConsoleErrorReporter = (): ErrorReporter => ({
  captureException(error: Error, context?: ErrorReporterContext): void {
    console.error('[ErrorReporter] captureException:', error.message, context);
  },
  captureMessage(message: string, context?: ErrorReporterContext): void {
    console.error('[ErrorReporter] captureMessage:', message, context);
  },
  setUserId(userId: string | null): void {
    console.info('[ErrorReporter] setUserId:', userId);
  },
});

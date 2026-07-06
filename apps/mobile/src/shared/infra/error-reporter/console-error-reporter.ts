import type { Breadcrumb } from '@src/core/ports/breadcrumb';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

export const createConsoleErrorReporter = (): ErrorReporter => ({
  captureException(error: Error, context?: ErrorReporterContext): void {
    context
      ? console.error('[ErrorReporter] captureException:', error.message, context)
      : console.error('[ErrorReporter] captureException:', error.message);
  },
  captureMessage(message: string, context?: ErrorReporterContext): void {
    context
      ? console.error('[ErrorReporter] captureMessage:', message, context)
      : console.error('[ErrorReporter] captureMessage:', message);
  },
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    console.info(
      `[ErrorReporter] breadcrumb(${breadcrumb.category}):`,
      breadcrumb.message,
      breadcrumb.data ?? {},
    );
  },
  setUserId(userId: string | null): void {
    console.info('[ErrorReporter] setUserId:', userId);
  },
});

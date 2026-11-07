import type { Breadcrumb } from '@src/core/observability/breadcrumb';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

export function createConsoleErrorReporter(): ErrorReporter {
  return {
    captureException(error: Error, context?: ErrorReporterContext): void {
      if (context) {
        console.error('[ErrorReporter] captureException:', error.message, context);
        return;
      }
      console.error('[ErrorReporter] captureException:', error.message);
    },
    captureMessage(message: string, context?: ErrorReporterContext): void {
      if (context) {
        console.error('[ErrorReporter] captureMessage:', message, context);
        return;
      }
      console.error('[ErrorReporter] captureMessage:', message);
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
  };
}

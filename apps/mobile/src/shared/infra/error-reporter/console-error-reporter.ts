import type { Breadcrumb } from '@src/core/observability/breadcrumb';
import type { Severity } from '@src/core/observability/severity';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

// 개발 빌드에서 console.error는 빨간 LogBox를 띄우므로 Sentry 등급과 같은 콘솔 함수로 찍는다
const WRITE_BY_SEVERITY = {
  debug: (...data: unknown[]) => console.debug(...data),
  info: (...data: unknown[]) => console.info(...data),
  warning: (...data: unknown[]) => console.warn(...data),
  error: (...data: unknown[]) => console.error(...data),
  fatal: (...data: unknown[]) => console.error(...data),
} as const satisfies Record<Severity, (...data: unknown[]) => void>;

function writeReport(kind: string, message: string, context?: ErrorReporterContext) {
  const write = WRITE_BY_SEVERITY[context?.severity ?? 'error'];
  if (context) {
    write(`[ErrorReporter] ${kind}:`, message, context);
    return;
  }
  write(`[ErrorReporter] ${kind}:`, message);
}

export function createConsoleErrorReporter(): ErrorReporter {
  return {
    captureException: (error: Error, context?: ErrorReporterContext): void => {
      writeReport('captureException', error.message, context);
    },
    captureMessage: (message: string, context?: ErrorReporterContext): void => {
      writeReport('captureMessage', message, context);
    },
    addBreadcrumb: (breadcrumb: Breadcrumb): void => {
      console.info(
        `[ErrorReporter] breadcrumb(${breadcrumb.category}):`,
        breadcrumb.message,
        breadcrumb.data ?? {},
      );
    },
    setUserId: (userId: string | null): void => {
      console.info('[ErrorReporter] setUserId:', userId);
    },
  };
}

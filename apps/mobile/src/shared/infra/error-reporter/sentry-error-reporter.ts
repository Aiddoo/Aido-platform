import * as Sentry from '@sentry/react-native';
import type { Breadcrumb } from '@src/core/observability/breadcrumb';
import type { Severity } from '@src/core/observability/severity';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';
import { captureError } from '@src/shared/infra/observability/capture-error';
import { mapValues, omitBy } from 'es-toolkit';

import { SENTRY_TAGS } from './sentry-tags';

/** `Record<Severity, ...>`라 Severity가 늘면 누락이 컴파일 오류가 난다 */
const severityToSentryLevel: Record<Severity, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warning: 'warning',
  error: 'error',
  fatal: 'fatal',
};

type ErrorReporterTagField = Exclude<keyof ErrorReporterContext, 'severity'>;

function toTags(context: ErrorReporterContext = {}): Record<string, string> {
  const tags = {
    [SENTRY_TAGS.FEATURE]: context.feature,
    [SENTRY_TAGS.ERROR_CODE]: context.errorCode,
    [SENTRY_TAGS.SERVER_ERROR_CODE]: context.serverErrorCode,
    [SENTRY_TAGS.METHOD]: context.method,
    [SENTRY_TAGS.ENDPOINT]: context.endpoint,
    [SENTRY_TAGS.STATUS_CODE]: context.statusCode,
  } satisfies Record<ErrorReporterTagField, ErrorReporterContext[ErrorReporterTagField]>;
  return mapValues(
    omitBy(tags, (value) => value == null),
    (value) => String(value),
  );
}

export function createSentryErrorReporter(): ErrorReporter {
  return {
    captureException: (error: Error, context?: ErrorReporterContext): void => {
      captureError(error, {
        level: severityToSentryLevel[context?.severity ?? 'error'],
        tags: toTags(context),
      });
    },
    captureMessage: (message: string, context?: ErrorReporterContext): void => {
      Sentry.captureMessage(message, {
        level: severityToSentryLevel[context?.severity ?? 'info'],
        tags: toTags(context),
      });
    },
    addBreadcrumb: (breadcrumb: Breadcrumb): void => {
      const crumb: Sentry.Breadcrumb = {
        category: breadcrumb.category,
        message: breadcrumb.message,
        level: severityToSentryLevel[breadcrumb.level ?? 'info'],
        data: breadcrumb.data,
      };
      Sentry.addBreadcrumb(crumb);
    },
    setUserId: (userId: string | null): void => {
      Sentry.setUser(userId ? { id: userId } : null);
    },
  };
}

import * as Sentry from '@sentry/react-native';
import {
  ERROR_REPORT_FEATURES,
  type ErrorReportFeature,
} from '@src/core/observability/telemetry-keys';
import type { LogContext, AppLogger, LogLevel } from '@src/core/ports/app-logger';
import { captureError } from '@src/shared/infra/observability/capture-error';

import { SENTRY_TAGS } from '../error-reporter/sentry-tags';

const toSentryLevel: Record<LogLevel, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const LOG_EVENT_KEY_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function logEventFeature(message: string): ErrorReportFeature | undefined {
  if (!LOG_EVENT_KEY_PATTERN.test(message)) {
    return undefined;
  }
  const [feature = ''] = message.split('.', 1);
  const featureTag = feature.replace(/-/g, '_');
  return ERROR_REPORT_FEATURES.find((known) => known === featureTag);
}

/** 카테고리가 있는 도메인 breadcrumb은 로거가 아니라 `ErrorReporter.addBreadcrumb`로 남긴다 */
export function createSentryLogger(): AppLogger {
  const breadcrumb = (level: LogLevel, message: string, context?: LogContext): void => {
    const crumb: Sentry.Breadcrumb = {
      level: toSentryLevel[level],
      message,
      data: context,
    };
    Sentry.addBreadcrumb(crumb);
  };

  return {
    debug(_message: string, _context?: LogContext): void {
      // debug는 Sentry에 남기지 않음(노이즈 억제).
    },
    info(message: string, context?: LogContext): void {
      breadcrumb('info', message, context);
    },
    warn(message: string, context?: LogContext): void {
      breadcrumb('warn', message, context);
    },
    error(message: string, error?: Error, context?: LogContext): void {
      breadcrumb('error', message, context);
      if (error) {
        const feature = logEventFeature(message);
        captureError(error, {
          tags: {
            [SENTRY_TAGS.SOURCE]: 'logger',
            ...(feature != null && { [SENTRY_TAGS.FEATURE]: feature }),
          },
          extra: { loggerMessage: message, ...context },
        });
      }
    },
  };
}

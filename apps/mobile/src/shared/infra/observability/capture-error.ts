import * as Sentry from '@sentry/react-native';
import { classifyErrorReport } from '@src/shared/errors/classify-error-report';
import { ServerError } from '@src/shared/errors/infra-error';
import { SENTRY_TAGS } from '@src/shared/observability/telemetry-keys';

interface CaptureErrorOptions {
  level?: Sentry.SeverityLevel;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
}

/** 이미 보고한 오류 객체. `Logger.error`와 `ErrorReporter`가 같은 오류를 두 번 보내지 않게 한다 */
const handledErrors = new WeakSet<Error>();

/**
 * Sentry로 오류를 보내는 유일한 입구(`Logger`와 `ErrorReporter` 어댑터가 함께 쓴다).
 * 이슈로 보낼지 breadcrumb로만 남길지는 `classifyErrorReport`가 정하고, 같은 오류 객체는 한 번만 다룬다.
 */
export function captureError(error: Error, { level, tags, extra }: CaptureErrorOptions): void {
  if (handledErrors.has(error)) {
    return;
  }
  handledErrors.add(error);

  if (classifyErrorReport(error) === 'breadcrumb') {
    Sentry.addBreadcrumb({
      category: 'error',
      level: 'warning',
      message: error.name,
      data: { ...tags, ...extra, error: error.message },
    });
    return;
  }

  Sentry.captureException(error, {
    ...(level && { level }),
    tags:
      error instanceof ServerError && error.requestId != null
        ? { ...tags, [SENTRY_TAGS.REQUEST_ID]: error.requestId }
        : tags,
    ...(extra && { extra }),
  });
}

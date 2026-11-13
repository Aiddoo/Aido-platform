import * as Sentry from '@sentry/react-native';
import { classifyError } from '@src/shared/errors/classify-error';
import { ServerError } from '@src/shared/errors/infra-error';

import { SENTRY_TAGS } from '../error-reporter/sentry-tags';

interface CaptureErrorOptions {
  level?: Sentry.SeverityLevel;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
}

/** 이미 보고한 오류 객체. `AppLogger.error`·`ErrorReporter`·경계·전역 캐시가 같은 오류를 두 번 보내지 않게 한다 */
const handledErrors = new WeakSet<Error>();

/** Sentry로 나가는 모든 오류가 지나는 한 곳. 이슈로 보낼지는 `classifyError`만 정한다 */
export function captureError(error: Error, { level, tags, extra }: CaptureErrorOptions): void {
  if (handledErrors.has(error)) {
    return;
  }
  handledErrors.add(error);

  if (classifyError(error).report === 'breadcrumb') {
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

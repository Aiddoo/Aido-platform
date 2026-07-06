import * as Sentry from '@sentry/react-native';
import type { Breadcrumb } from '@src/core/ports/breadcrumb';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';
import type { Severity } from '@src/core/ports/severity';

/**
 * Severity → Sentry `SeverityLevel` 매핑.
 * `Record<Severity, ...>`라 Severity 확장 시 컴파일 타임에 누락을 강제한다.
 */
const severityToSentryLevel: Record<Severity, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warning: 'warning',
  error: 'error',
  fatal: 'fatal',
};

/** ErrorReporterContext에서 severity를 제외한 나머지를 Sentry tags로 변환(undefined 제거, 문자열화). */
const toTags = (context?: ErrorReporterContext): Record<string, string> => {
  const tags: Record<string, string> = {};
  if (!context) return tags;
  for (const [key, value] of Object.entries(context)) {
    if (key === 'severity' || value === undefined) continue;
    tags[key] = String(value);
  }
  return tags;
};

/**
 * Sentry 기반 ErrorReporter 어댑터.
 *
 * 벤더(Sentry) 전용 코드는 이 파일에만 격리된다. 콜사이트는 `ErrorReporter` 포트만 의존하므로
 * 다른 벤더로 교체 시 이 어댑터만 갈아끼우면 된다.
 */
export const createSentryErrorReporter = (): ErrorReporter => ({
  captureException(error: Error, context?: ErrorReporterContext): void {
    Sentry.captureException(error, {
      level: severityToSentryLevel[context?.severity ?? 'error'],
      tags: toTags(context),
    });
  },
  captureMessage(message: string, context?: ErrorReporterContext): void {
    Sentry.captureMessage(message, {
      level: severityToSentryLevel[context?.severity ?? 'info'],
      tags: toTags(context),
    });
  },
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    const crumb: Sentry.Breadcrumb = {
      category: breadcrumb.category,
      message: breadcrumb.message,
      level: severityToSentryLevel[breadcrumb.level ?? 'info'],
      data: breadcrumb.data,
    };
    Sentry.addBreadcrumb(crumb);
  },
  setUserId(userId: string | null): void {
    Sentry.setUser(userId ? { id: userId } : null);
  },
});

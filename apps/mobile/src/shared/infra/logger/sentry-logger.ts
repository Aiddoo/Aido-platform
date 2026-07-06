import * as Sentry from '@sentry/react-native';
import type { LogContext, Logger, LogLevel } from '@src/core/ports/logger';

/**
 * Sentry 기반 Logger 어댑터.
 *
 * 일반 로그를 Sentry breadcrumb로 남겨 이후 이벤트/크래시 리포트에 타임라인으로 첨부한다.
 * `error`는 breadcrumb에 더해, Error 객체가 있으면 non-fatal 이벤트로 수집한다
 * (기존 Crashlytics `recordError` 대체). 벤더 코드는 이 파일에만 격리된다.
 *
 * 카테고리가 있는 도메인 breadcrumb(http·navigation 등)는 로거가 아니라
 * `ErrorReporter.addBreadcrumb`(typed `BreadcrumbCategory`)로 남긴다 — 여기선 category를 다루지 않는다.
 */
const toSentryLevel: Record<LogLevel, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

export const createSentryLogger = (): Logger => {
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
        // 커스텀 메시지·컨텍스트를 extra로 첨부 → Sentry 이슈 상세에서 바로 확인 가능.
        Sentry.captureException(error, {
          tags: { source: 'logger' },
          extra: { loggerMessage: message, ...context },
        });
      }
    },
  };
};

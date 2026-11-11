import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import { WindowedCounter } from "#api/shared/application/alerts/windowed-counter";
import type {
  ExceptionReportContext,
  ExceptionReporterPort,
} from "#api/shared/application/ports/exception-reporter.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";
import { SENTRY_TAG } from "./sentry-keys.js";

/**
 * 같은 원인(분류 키 또는 경로·오류 코드·예외 이름)의 예외는 한 시간에 이만큼만 보낸다.
 * 한 경로가 계속 실패해도 무료 플랜 월 5천 건 오류 한도를 하루에 다 쓰지 않게 하고, 이슈 수는 그대로 남는다.
 */
export const EXCEPTION_REPORT_THRESHOLD = 10;
export const EXCEPTION_REPORT_WINDOW_MS = 60 * 60_000;

/** 5xx 예외를 Sentry 이슈로 남긴다. 사용자는 ID만 싣고 IP는 instrument.ts의 beforeSend가 지운다. */
@Injectable()
export class SentryExceptionReporter implements ExceptionReporterPort {
  readonly #logger = new Logger(SentryExceptionReporter.name);
  readonly #reports = new WindowedCounter(EXCEPTION_REPORT_WINDOW_MS);

  report(error: unknown, context: ExceptionReportContext): void {
    try {
      if (this.#reports.add(budgetKey(error, context), Date.now()) > EXCEPTION_REPORT_THRESHOLD) {
        return;
      }
      Sentry.withScope((scope) => {
        scope.setUser(context.userId == null ? null : { id: context.userId });
        scope.setTags(context.tags);
        if (context.groupKey != null) {
          scope.setFingerprint([context.groupKey]);
        }
        for (const [key, value] of Object.entries(context.extras ?? {})) {
          scope.setExtra(key, value);
        }
        Sentry.captureException(error);
      });
    } catch (reportError) {
      this.#logger.warn({
        event: PlatformLogEvent.EXCEPTION_REPORT_FAILED,
        errorType: toErrorType(reportError),
      });
    }
  }
}

function budgetKey(error: unknown, context: ExceptionReportContext): string {
  return (
    context.groupKey ??
    [
      context.tags[SENTRY_TAG.HTTP_ROUTE] ?? "",
      context.tags[SENTRY_TAG.ERROR_CODE] ?? "",
      toErrorType(error),
    ].join(" ")
  );
}

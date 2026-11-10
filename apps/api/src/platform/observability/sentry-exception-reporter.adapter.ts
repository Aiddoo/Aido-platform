import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import type {
  ExceptionReportContext,
  ExceptionReporterPort,
} from "#api/shared/application/ports/exception-reporter.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";

/** 5xx 예외를 Sentry 이슈로 남긴다. 사용자는 ID만 싣고 IP는 instrument.ts의 beforeSend가 지운다. */
@Injectable()
export class SentryExceptionReporter implements ExceptionReporterPort {
  readonly #logger = new Logger(SentryExceptionReporter.name);

  report(error: unknown, context: ExceptionReportContext): void {
    try {
      Sentry.withScope((scope) => {
        scope.setUser(context.userId == null ? null : { id: context.userId });
        scope.setTags(context.tags);
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

import { Injectable, Logger } from "@nestjs/common";

import type {
  ExceptionReportContext,
  ExceptionReporterPort,
} from "#api/shared/application/ports/exception-reporter.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";

/** Sentry로 보내지 않는 환경에서 5xx 예외를 Sentry 대신 태그·스택과 함께 콘솔 로그로 남긴다. */
@Injectable()
export class LogExceptionReporterAdapter implements ExceptionReporterPort {
  readonly #logger = new Logger(LogExceptionReporterAdapter.name);

  report(error: unknown, context: ExceptionReportContext): void {
    this.#logger.error(
      {
        event: PlatformLogEvent.EXCEPTION_REPORTED,
        userId: context.userId,
        tags: context.tags,
        errorType: toErrorType(error),
      },
      error instanceof Error ? error.stack : undefined,
    );
  }
}

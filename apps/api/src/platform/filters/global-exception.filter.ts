import type { RestErrorResponse } from "@aido/api";
import { ErrorCode, type ErrorCodeType, Errors, toPublicErrorDetails } from "@aido/api/errors";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";

import { appConfig } from "#api/platform/config/app.config";
import {
  classifyDatabaseError,
  databaseConstraint,
  databaseSqlState,
  isRecordNotFoundError,
} from "#api/platform/database/database-error.util";
import { readRequestUserId } from "#api/platform/http/request-user-id";
import { ErrorMessageTranslator } from "#api/platform/i18n/error-message.translator";
import { HttpLogEvent, httpRequestPath } from "#api/platform/logging/http-log";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { SENTRY_EXTRA, SENTRY_TAG } from "#api/platform/observability/sentry-keys";
import { ApplicationException } from "#api/shared/application/application.exception";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";
import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { LEGACY_CONSTRAINT_ERRORS } from "./legacy-constraint-errors.js";

/**
 * 카탈로그에 상태별 공통 코드가 400(SYS_0002)·500(SYS_0001)뿐이고 출시 앱은 모르는 코드를 SYS_0001로 바꾼다.
 * 429는 "잠시 후 다시 시도" 안내를 유지하려고 출시 이후 응답해 온 SYS_0001로 둔다.
 */
function httpExceptionErrorCode(statusCode: number): ErrorCodeType {
  return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ||
    statusCode === HttpStatus.TOO_MANY_REQUESTS
    ? ErrorCode.SYS_0001
    : ErrorCode.SYS_0002;
}

function isDatabaseFailure(exception: unknown): boolean {
  return (
    databaseSqlState(exception) != null ||
    isRecordNotFoundError(exception) ||
    classifyDatabaseError(exception) !== "unknown"
  );
}

const UNKNOWN_UNIQUE_CONSTRAINT_ALERT_KEY = "database.unique-constraint.unknown";

/** 모든 예외를 공유 오류 envelope로 바꾸고, 5xx만 예외 보고로 보낸다. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  readonly #logger: PinoLogger;
  readonly #config: Pick<ConfigType<typeof appConfig>, "isDevelopment">;
  readonly #messages: ErrorMessageTranslator;
  readonly #exceptionReporter: ExceptionReporterPort;
  readonly #operationalAlert: OperationalAlertPort;

  constructor(
    logger: PinoLogger,
    @Inject(appConfig.KEY) config: Pick<ConfigType<typeof appConfig>, "isDevelopment">,
    messages: ErrorMessageTranslator,
    exceptionReporter: ExceptionReporterPort,
    operationalAlert: OperationalAlertPort,
  ) {
    this.#logger = logger;
    this.#config = config;
    this.#messages = messages;
    this.#exceptionReporter = exceptionReporter;
    this.#operationalAlert = operationalAlert;
    this.#logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { statusCode, errorResponse } = this.#toResponse(exception);

    const userId = readRequestUserId(request) ?? "anonymous";
    const requestPath = httpRequestPath(request.url);

    // 4xx는 앱이 처리하는 업무 거부라 보고하지 않는다
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.#exceptionReporter.report(exception, {
        userId: userId === "anonymous" ? null : userId,
        tags: {
          [SENTRY_TAG.HTTP_METHOD]: request.method,
          [SENTRY_TAG.HTTP_URL]: requestPath,
          [SENTRY_TAG.HTTP_STATUS_CODE]: String(statusCode),
          [SENTRY_TAG.ERROR_CODE]: errorResponse.error.code,
        },
        extras: { [SENTRY_EXTRA.ERROR_RESPONSE]: errorResponse },
      });
    }

    const logFields = {
      event: HttpLogEvent.REQUEST_FAILED,
      method: request.method,
      path: requestPath,
      statusCode,
      errorCode: errorResponse.error.code,
      userId,
    };
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.#logger.error(
        {
          ...logFields,
          errorType: exception instanceof Error ? exception.name : "UnknownError",
          stack:
            exception instanceof Error
              ? exception.stack?.match(/^\s+at .+$/gm)?.join("\n")
              : undefined,
        },
        "HTTP 요청 실패",
      );
    } else {
      this.#logger.warn(logFields, "HTTP 요청 거부");
    }

    response.status(statusCode).json(errorResponse);
  }

  #toResponse(exception: unknown): { statusCode: number; errorResponse: RestErrorResponse } {
    if (exception instanceof ErrorCodedException) {
      return this.#toRestErrorResponse(exception);
    }
    if (exception instanceof HttpException) {
      return this.#fromHttpException(exception);
    }
    if (isDatabaseFailure(exception)) {
      return this.#toRestErrorResponse(this.#mapDatabaseError(exception));
    }
    const errorMessage =
      exception instanceof Error ? exception.message : Errors[ErrorCode.SYS_0001].message;
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: {
        success: false,
        error: {
          code: ErrorCode.SYS_0001,
          message: this.#messages.translate(ErrorCode.SYS_0001),
          ...(this.#config.isDevelopment && { details: errorMessage }),
        },
        timestamp: Date.now(),
      },
    };
  }

  /** 검증 파이프·없는 route·throttler 문구는 출시 계약이라 그대로 둔다. */
  #fromHttpException(exception: HttpException): {
    statusCode: number;
    errorResponse: RestErrorResponse;
  } {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const hasMessage = typeof exceptionResponse === "object" && "message" in exceptionResponse;
    return {
      statusCode,
      errorResponse: {
        success: false,
        error: {
          code: httpExceptionErrorCode(statusCode),
          message: hasMessage
            ? Array.isArray(exceptionResponse.message)
              ? exceptionResponse.message.join(", ")
              : String(exceptionResponse.message)
            : exception.message,
          ...(hasMessage && this.#config.isDevelopment && { details: exceptionResponse }),
        },
        timestamp: Date.now(),
      },
    };
  }

  #toRestErrorResponse(exception: ErrorCodedException): {
    statusCode: number;
    errorResponse: RestErrorResponse;
  } {
    const definition = Errors[exception.errorCode];
    // 운영에서는 앱이 계약으로 쓰는 코드의 검증된 상세만 내보낸다
    const details = this.#config.isDevelopment
      ? exception.details
      : toPublicErrorDetails(exception.errorCode, exception.details);
    return {
      statusCode: definition.httpStatus,
      errorResponse: {
        success: false,
        error: {
          code: exception.errorCode,
          message: this.#messageOf(exception),
          // nullish-strict: undefined는 비공개로 숨긴 상세, null은 담아 보낸 값이라 구분한다
          ...(details !== undefined && { details }),
        },
        timestamp: Date.now(),
      },
    };
  }

  /** 코드의 기본 문구는 요청 언어로 바꾸고, 던진 곳이 정한 문구는 그대로 둔다. */
  #messageOf(exception: ErrorCodedException): string {
    const isCustomMessage =
      exception.message !== "" && exception.message !== Errors[exception.errorCode].message;
    return isCustomMessage ? exception.message : this.#messages.translate(exception.errorCode);
  }

  #mapDatabaseError(error: unknown): ErrorCodedException {
    if (isRecordNotFoundError(error)) {
      return ApplicationExceptions.invalidParameter(
        this.#config.isDevelopment ? { reason: "Record to update/delete not found" } : undefined,
      );
    }
    const kind = classifyDatabaseError(error);
    switch (kind) {
      case "unique-violation":
        return this.#mapUniqueConstraintError(error);
      case "foreign-key-violation":
        this.#logger.warn({
          event: PlatformLogEvent.DATABASE_FOREIGN_KEY_VIOLATED,
          constraint: databaseConstraint(error) ?? "unknown",
        });
        return ApplicationExceptions.invalidParameter(
          this.#config.isDevelopment ? { reason: "Referenced record does not exist" } : undefined,
        );
      case "connection":
      case "pool-timeout":
      case "statement-timeout":
      case "lock-timeout":
        this.#logger.warn({
          event: PlatformLogEvent.DATABASE_TRANSIENT_FAILURE,
          kind,
          sqlState: databaseSqlState(error) ?? "none",
        });
        return new ApplicationException(
          ErrorCode.SYS_0005,
          this.#config.isDevelopment ? { kind } : undefined,
        );
      default: {
        const sqlState = databaseSqlState(error);
        this.#logger.warn({
          event: PlatformLogEvent.DATABASE_ERROR_UNHANDLED,
          sqlState: sqlState ?? "unknown",
        });
        return ApplicationExceptions.internalServerError(
          this.#config.isDevelopment ? { sqlState } : undefined,
        );
      }
    }
  }

  /** 저장소가 번역하지 않은 unique 충돌. 알려진 옛 제약은 업무 오류, 모르는 제약은 SYS_0004 + 경보다. */
  #mapUniqueConstraintError(error: unknown): ErrorCodedException {
    const constraint = databaseConstraint(error) ?? "unknown";
    const legacyError = Object.hasOwn(LEGACY_CONSTRAINT_ERRORS, constraint)
      ? LEGACY_CONSTRAINT_ERRORS[constraint]
      : undefined;
    if (legacyError != null) {
      return legacyError();
    }
    this.#logger.warn({ event: PlatformLogEvent.DATABASE_UNIQUE_CONSTRAINT_UNKNOWN, constraint });
    this.#operationalAlert.raise({
      key: UNKNOWN_UNIQUE_CONSTRAINT_ALERT_KEY,
      severity: "warning",
      message: "저장소가 번역하지 않은 unique 제약 충돌",
      tags: { constraint },
    });
    return ApplicationExceptions.concurrentModification();
  }
}

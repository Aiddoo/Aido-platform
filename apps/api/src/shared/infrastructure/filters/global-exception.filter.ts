import { ErrorCode, Errors } from "@aido/api/errors";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";

import {
  BusinessException,
  BusinessExceptions,
} from "#api/shared/application/exceptions/business-exception.service";
import type { ErrorResponse } from "#api/shared/application/exceptions/error.interface";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import {
  databaseConstraint,
  databaseSqlState,
  isRecordNotFoundError,
} from "#api/shared/infrastructure/database/prisma-error.util";

/**
 * 전역 예외 필터
 * 모든 예외를 일관된 형식으로 처리
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
  ) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Domain/Application 예외(순수 계층) → BusinessException 정규화
    // 동일 ErrorCode를 사용하므로 응답 포맷이 기존과 바이트 단위로 동일
    const normalized =
      exception instanceof ErrorCodedException
        ? new BusinessException(exception.errorCode, exception.details, exception.message)
        : exception;

    let errorResponse: ErrorResponse;
    let statusCode: HttpStatus;

    if (normalized instanceof BusinessException) {
      // Business Exception 처리
      statusCode = normalized.getStatus();
      const response = normalized.getResponse() as ErrorResponse;

      // 프로덕션에서는 details 필드 제거 (민감 정보 노출 방지)
      if (!this.configService.isDevelopment && response.error?.details !== undefined) {
        const { details: _, ...errorWithoutDetails } = response.error;
        errorResponse = {
          ...response,
          error: errorWithoutDetails,
        };
      } else {
        errorResponse = response;
      }
    } else if (normalized instanceof HttpException) {
      // HTTP Exception 처리
      statusCode = normalized.getStatus();
      const exceptionResponse = normalized.getResponse();

      if (typeof exceptionResponse === "object" && "message" in exceptionResponse) {
        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.SYS_0002,
            message: Array.isArray(exceptionResponse.message)
              ? exceptionResponse.message.join(", ")
              : String(exceptionResponse.message),
            ...(this.configService.isDevelopment && {
              details: exceptionResponse,
            }),
          },
          timestamp: Date.now(),
        };
      } else {
        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.SYS_0001,
            message: normalized.message,
          },
          timestamp: Date.now(),
        };
      }
    } else if (databaseSqlState(normalized) !== undefined || isRecordNotFoundError(normalized)) {
      // Database 에러 처리
      const businessException = this.#mapDatabaseError(normalized);
      statusCode = businessException.getStatus();
      errorResponse = businessException.getResponse() as ErrorResponse;
    } else {
      // 알 수 없는 예외 처리
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage =
        exception instanceof Error ? exception.message : Errors[ErrorCode.SYS_0001].message;
      errorResponse = {
        success: false,
        error: {
          code: ErrorCode.SYS_0001,
          message: Errors[ErrorCode.SYS_0001].message,
          ...(this.configService.isDevelopment && {
            details: errorMessage,
          }),
        },
        timestamp: Date.now(),
      };
    }

    // 사용자 ID 추출 (Sentry 컨텍스트 + 로깅 공용)
    const userId =
      (request as Request & { user?: { userId?: string } }).user?.userId ?? "anonymous";

    // 서버 에러(5xx)만 Sentry에 캡처 (4xx 클라이언트 에러는 노이즈 방지)
    if (statusCode >= 500) {
      Sentry.withScope((scope) => {
        scope.setUser({
          id: userId !== "anonymous" ? userId : undefined,
          ip_address: "{{auto}}",
        });
        scope.setTags({
          "http.method": request.method,
          "http.url": request.url,
          "http.status_code": String(statusCode),
          "error.code": errorResponse.error.code,
        });
        scope.setExtra("errorResponse", errorResponse);
        Sentry.captureException(exception);
      });
    }

    // 에러 로깅 (pinoHttp가 요청/응답은 자동 로깅하므로 에러 정보만 간결하게)
    if (statusCode >= 500) {
      // 서버 에러: 스택 트레이스 포함
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} ${statusCode} [${errorResponse.error.code}] ${errorResponse.error.message} [user:${userId}]\n${stack ?? ""}`,
      );
    } else {
      // 클라이언트 에러: 간결하게
      this.logger.warn(
        `${request.method} ${request.url} ${statusCode} [${errorResponse.error.code}] ${errorResponse.error.message} [user:${userId}]`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Database 에러 → BusinessException 매핑
   *
   * Unique, foreign key, and missing-record errors 등 주요 에러를 비즈니스 에러로 변환
   */
  #mapDatabaseError(error: unknown): BusinessException {
    if (isRecordNotFoundError(error)) {
      return BusinessExceptions.invalidParameter(
        this.configService.isDevelopment
          ? { reason: "Record to update/delete not found" }
          : undefined,
      );
    }
    const sqlState = databaseSqlState(error);
    switch (sqlState) {
      case "23505":
        return this.#mapUniqueConstraintError(error);
      case "23503":
        this.logger.warn(
          `PostgreSQL foreign key violation: ${databaseConstraint(error) ?? "unknown"}`,
        );
        return BusinessExceptions.invalidParameter(
          this.configService.isDevelopment
            ? { reason: "Referenced record does not exist" }
            : undefined,
        );
      default:
        this.logger.warn(`Unhandled database error: ${sqlState ?? "unknown"}`);
        return BusinessExceptions.internalServerError(
          this.configService.isDevelopment ? { sqlState } : undefined,
        );
    }
  }

  /**
   * PostgreSQL unique constraint violation → BusinessException 매핑
   *
   * 알려진 constraint는 구체적인 에러 코드로, 미지의 constraint는 SYS_0004로 폴백
   */
  #mapUniqueConstraintError(error: unknown): BusinessException {
    const constraintKey = databaseConstraint(error) ?? "unknown";

    const constraintMap: Record<string, () => BusinessException> = {
      User_email_key: () => BusinessExceptions.emailAlreadyRegistered(""),
      email: () => BusinessExceptions.emailAlreadyRegistered(""),
      User_userTag_key: () =>
        BusinessExceptions.internalServerError({ detail: "userTag collision" }),
      userTag: () => BusinessExceptions.internalServerError({ detail: "userTag collision" }),
      TodoCategory_userId_name_key: () => BusinessExceptions.todoCategoryNameDuplicate(""),
      userId_name: () => BusinessExceptions.todoCategoryNameDuplicate(""),
      Follow_followerId_followingId_key: () => BusinessExceptions.followRequestAlreadySent(""),
      followerId_followingId: () => BusinessExceptions.followRequestAlreadySent(""),
      Account_provider_providerAccountId_key: () => BusinessExceptions.accountAlreadyExists(),
      provider_providerAccountId: () => BusinessExceptions.accountAlreadyExists(),
      Account_userId_provider_key: () => BusinessExceptions.accountAlreadyExists(),
      userId_provider: () => BusinessExceptions.accountAlreadyExists(),
      Notification_daily_dedup: () => BusinessExceptions.concurrentModification(),
      userId_type_notificationDate: () => BusinessExceptions.concurrentModification(),
      Notification_friend_dedup: () => BusinessExceptions.concurrentModification(),
      userId_type_friendId_notificationDate: () => BusinessExceptions.concurrentModification(),
    };

    const factory = constraintMap[constraintKey];
    if (factory) {
      return factory();
    }

    // 알 수 없는 constraint → warn 로그 + SYS_0004 폴백
    this.logger.warn(`Unknown database unique constraint: ${constraintKey}`);
    return BusinessExceptions.concurrentModification();
  }
}

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 표준화된 에러 응답 인터페이스
 */
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

/**
 * 전역 HTTP 예외 필터
 * 모든 예외를 일관된 형식으로 응답
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.getErrorDetails(exception);

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 에러 로깅
    this.logError(exception, request, statusCode);

    response.status(statusCode).json(errorResponse);
  }

  private getErrorDetails(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        return {
          statusCode: status,
          message: (responseObj.message as string | string[]) || exception.message,
          error: (responseObj.error as string) || this.getErrorName(status),
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: this.getErrorName(status),
      };
    }

    // 예상치 못한 에러
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    };

    return errorNames[status] || 'Unknown Error';
  }

  private logError(exception: unknown, request: Request, statusCode: number): void {
    const logContext = {
      method: request.method,
      url: request.url,
      statusCode,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    if (statusCode >= 500) {
      // 서버 에러는 스택 트레이스 포함
      this.logger.error(
        `[${request.method}] ${request.url} - ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
        logContext,
      );
    } else if (statusCode >= 400) {
      // 클라이언트 에러는 경고로 처리
      this.logger.warn(`[${request.method}] ${request.url} - ${statusCode}`, logContext);
    }
  }
}

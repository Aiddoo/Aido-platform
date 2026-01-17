import { ErrorCode, Errors } from "@aido/errors";
import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import type { ErrorResponse } from "../interfaces/error.interface";
import { BusinessException } from "../services/business-exception.service";

/**
 * 전역 예외 필터
 * 모든 예외를 일관된 형식으로 처리
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: PinoLogger) {
		this.logger.setContext(GlobalExceptionFilter.name);
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		let errorResponse: ErrorResponse;
		let statusCode: HttpStatus;

		if (exception instanceof BusinessException) {
			// Business Exception 처리
			statusCode = exception.getStatus();
			errorResponse = exception.getResponse() as ErrorResponse;
		} else if (exception instanceof HttpException) {
			// HTTP Exception 처리
			statusCode = exception.getStatus();
			const exceptionResponse = exception.getResponse();

			if (
				typeof exceptionResponse === "object" &&
				"message" in exceptionResponse
			) {
				errorResponse = {
					success: false,
					error: {
						code: ErrorCode.SYS_0002,
						message: Array.isArray(exceptionResponse.message)
							? exceptionResponse.message.join(", ")
							: String(exceptionResponse.message),
						details: exceptionResponse,
					},
					timestamp: Date.now(),
				};
			} else {
				errorResponse = {
					success: false,
					error: {
						code: ErrorCode.SYS_0001,
						message: exception.message,
					},
					timestamp: Date.now(),
				};
			}
		} else {
			// 알 수 없는 예외 처리
			statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
			const errorMessage =
				exception instanceof Error
					? exception.message
					: Errors[ErrorCode.SYS_0001].message;
			errorResponse = {
				success: false,
				error: {
					code: ErrorCode.SYS_0001,
					message: Errors[ErrorCode.SYS_0001].message,
					details: errorMessage,
				},
				timestamp: Date.now(),
			};
		}

		// 에러 로깅 (pinoHttp가 요청/응답은 자동 로깅하므로 에러 정보만 간결하게)
		const userId =
			(request as Request & { user?: { userId?: string } }).user?.userId ??
			"anonymous";
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
}

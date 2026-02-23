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
import { TypedConfigService } from "@/common/config/services/config.service";
import { Prisma } from "@/generated/prisma/client";
import type { ErrorResponse } from "../interfaces/error.interface";
import {
	BusinessException,
	BusinessExceptions,
} from "../services/business-exception.service";

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

		let errorResponse: ErrorResponse;
		let statusCode: HttpStatus;

		if (exception instanceof BusinessException) {
			// Business Exception 처리
			statusCode = exception.getStatus();
			const response = exception.getResponse() as ErrorResponse;

			// 프로덕션에서는 details 필드 제거 (민감 정보 노출 방지)
			if (
				!this.configService.isDevelopment &&
				response.error?.details !== undefined
			) {
				const { details: _, ...errorWithoutDetails } = response.error;
				errorResponse = {
					...response,
					error: errorWithoutDetails,
				};
			} else {
				errorResponse = response;
			}
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
						message: exception.message,
					},
					timestamp: Date.now(),
				};
			}
		} else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
			// Prisma 에러 처리
			const businessException =
				this.#mapPrismaErrorToBusinessException(exception);
			statusCode = businessException.getStatus();
			errorResponse = businessException.getResponse() as ErrorResponse;
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
					...(this.configService.isDevelopment && {
						details: errorMessage,
					}),
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

	/**
	 * Prisma 에러 → BusinessException 매핑
	 *
	 * P2002(unique), P2003(FK), P2025(not found) 등 주요 에러를 비즈니스 에러로 변환
	 */
	#mapPrismaErrorToBusinessException(
		error: InstanceType<typeof Prisma.PrismaClientKnownRequestError>,
	): BusinessException {
		switch (error.code) {
			case "P2002":
				return this.#mapP2002ToBusinessException(error);
			case "P2003":
				// Foreign key constraint violation
				this.logger.warn(
					`Prisma P2003: FK constraint violation (meta: ${JSON.stringify(error.meta)})`,
				);
				return BusinessExceptions.invalidParameter(
					this.configService.isDevelopment
						? { reason: "Referenced record does not exist" }
						: undefined,
				);
			case "P2025":
				// Record not found
				return BusinessExceptions.invalidParameter(
					this.configService.isDevelopment
						? { reason: "Record to update/delete not found" }
						: undefined,
				);
			default:
				this.logger.warn(
					`Unhandled Prisma error: ${error.code} (meta: ${JSON.stringify(error.meta)})`,
				);
				return BusinessExceptions.internalServerError(
					this.configService.isDevelopment
						? { prismaCode: error.code }
						: undefined,
				);
		}
	}

	/**
	 * Prisma P2002 (unique constraint violation) → BusinessException 매핑
	 *
	 * 알려진 constraint는 구체적인 에러 코드로, 미지의 constraint는 SYS_0004로 폴백
	 */
	#mapP2002ToBusinessException(
		error: InstanceType<typeof Prisma.PrismaClientKnownRequestError>,
	): BusinessException {
		const target = error.meta?.target;
		const constraintKey = Array.isArray(target)
			? target.join("_")
			: String(target ?? "unknown");

		const constraintMap: Record<string, () => BusinessException> = {
			User_email_key: () => BusinessExceptions.emailAlreadyRegistered(""),
			email: () => BusinessExceptions.emailAlreadyRegistered(""),
			User_userTag_key: () =>
				BusinessExceptions.internalServerError({ detail: "userTag collision" }),
			userTag: () =>
				BusinessExceptions.internalServerError({ detail: "userTag collision" }),
			TodoCategory_userId_name_key: () =>
				BusinessExceptions.todoCategoryNameDuplicate(""),
			userId_name: () => BusinessExceptions.todoCategoryNameDuplicate(""),
			Follow_followerId_followingId_key: () =>
				BusinessExceptions.followRequestAlreadySent(""),
			followerId_followingId: () =>
				BusinessExceptions.followRequestAlreadySent(""),
			Account_provider_providerAccountId_key: () =>
				BusinessExceptions.accountAlreadyExists(),
			provider_providerAccountId: () =>
				BusinessExceptions.accountAlreadyExists(),
			Account_userId_provider_key: () =>
				BusinessExceptions.accountAlreadyExists(),
			userId_provider: () => BusinessExceptions.accountAlreadyExists(),
			Notification_daily_dedup: () =>
				BusinessExceptions.concurrentModification(),
			userId_type_notificationDate: () =>
				BusinessExceptions.concurrentModification(),
			Notification_friend_dedup: () =>
				BusinessExceptions.concurrentModification(),
			userId_type_friendId_notificationDate: () =>
				BusinessExceptions.concurrentModification(),
		};

		const factory = constraintMap[constraintKey];
		if (factory) {
			return factory();
		}

		// 알 수 없는 constraint → warn 로그 + SYS_0004 폴백
		this.logger.warn(
			`Unknown P2002 constraint: ${constraintKey} (meta: ${JSON.stringify(error.meta)})`,
		);
		return BusinessExceptions.concurrentModification();
	}
}

import { type ErrorCodeType, Errors } from "@aido/errors";
import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";

import { SWAGGER_DESCRIPTION } from "../constants/swagger.constant";
import type { ApiErrorResponseOptions } from "../interfaces/swagger.interface";
import { ErrorResponseSchema } from "../schemas/response.schema";

/**
 * 에러 응답 스키마 생성 (에러 코드, 메시지 포함)
 */
function createErrorSchema(errorCode: ErrorCodeType, message: string) {
	return {
		type: "object",
		properties: {
			success: { type: "boolean", example: false },
			error: {
				type: "object",
				properties: {
					code: { type: "string", example: errorCode },
					message: { type: "string", example: message },
					details: { type: "object", nullable: true, example: null },
				},
				required: ["code", "message"],
			},
			timestamp: { type: "number", example: Date.now() },
		},
		required: ["success", "error", "timestamp"],
	};
}

/**
 * 에러 응답 데코레이터
 *
 * 기존 ERROR_CODE, ERROR_MESSAGE, ERROR_HTTP_STATUS 상수를 재사용하여
 * Swagger 에러 응답 문서를 생성합니다.
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiErrorResponse({ errorCode: 'USER_NOT_FOUND' })
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiErrorResponse(
	options: ApiErrorResponseOptions,
): MethodDecorator {
	const { errorCode, description } = options;

	const errorDef = Errors[errorCode];
	const httpStatus = errorDef?.httpStatus ?? HttpStatus.BAD_REQUEST;
	const message = description ?? errorDef?.message ?? "Unknown error";

	return applyDecorators(
		ApiResponse({
			status: httpStatus,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 404 Not Found 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiNotFoundError('USER_NOT_FOUND')
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiNotFoundError(errorCode: ErrorCodeType): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Not found";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 401 Unauthorized 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @ApiUnauthorizedError()
 * getProfile() { ... }
 * ```
 */
export function ApiUnauthorizedError(description?: string): MethodDecorator {
	return applyDecorators(
		ApiResponse({
			status: HttpStatus.UNAUTHORIZED,
			description: description ?? SWAGGER_DESCRIPTION.UNAUTHORIZED_401,
			type: ErrorResponseSchema,
		}),
	);
}

/**
 * 403 Forbidden 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Delete(':id')
 * @ApiForbiddenError()
 * delete(@Param('id') id: number) { ... }
 * ```
 */
export function ApiForbiddenError(description?: string): MethodDecorator {
	return applyDecorators(
		ApiResponse({
			status: HttpStatus.FORBIDDEN,
			description: description ?? SWAGGER_DESCRIPTION.FORBIDDEN_403,
			type: ErrorResponseSchema,
		}),
	);
}

/**
 * 409 Conflict 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post()
 * @ApiConflictError('EMAIL_ALREADY_EXISTS')
 * create(@Body() dto: CreateUserDto) { ... }
 * ```
 */
export function ApiConflictError(errorCode: ErrorCodeType): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Conflict";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.CONFLICT,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 422 Unprocessable Entity 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('verify')
 * @ApiUnprocessableError('VERIFICATION_CODE_EXPIRED')
 * verify(@Body() dto: VerifyDto) { ... }
 * ```
 */
export function ApiUnprocessableError(
	errorCode: ErrorCodeType,
): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Unprocessable";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 400 Bad Request 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post(':userId')
 * @ApiBadRequestError('CANNOT_FOLLOW_SELF')
 * sendRequest(@Param('userId') userId: string) { ... }
 * ```
 */
export function ApiBadRequestError(errorCode: ErrorCodeType): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Bad request";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.BAD_REQUEST,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 503 Service Unavailable 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('parse')
 * @ApiServiceUnavailableError('AI_SERVICE_UNAVAILABLE')
 * parse(@Body() dto: ParseDto) { ... }
 * ```
 */
export function ApiServiceUnavailableError(
	errorCode: ErrorCodeType,
): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Service unavailable";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.SERVICE_UNAVAILABLE,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

/**
 * 429 Too Many Requests 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('parse')
 * @ApiTooManyRequestsError('AI_USAGE_LIMIT_EXCEEDED')
 * parse(@Body() dto: ParseDto) { ... }
 * ```
 */
export function ApiTooManyRequestsError(
	errorCode: ErrorCodeType,
): MethodDecorator {
	const message = Errors[errorCode]?.message ?? "Too many requests";

	return applyDecorators(
		ApiResponse({
			status: HttpStatus.TOO_MANY_REQUESTS,
			description: message,
			schema: createErrorSchema(errorCode, message),
		}),
	);
}

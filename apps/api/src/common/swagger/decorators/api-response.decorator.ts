import { applyDecorators, HttpStatus, type Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

import { SWAGGER_DESCRIPTION } from "../constants/swagger.constant";
import type {
	ApiCreatedResponseOptions,
	ApiPaginatedResponseOptions,
	ApiSuccessResponseOptions,
} from "../interfaces/swagger.interface";
import {
	CursorPaginationInfoSchema,
	PaginationInfoSchema,
} from "../schemas/response.schema";

/**
 * 성공 응답 래퍼 스키마 생성
 * { success: true, data: T | T[], timestamp: number }
 */
function createSuccessSchema<T>(type: Type<T>, isArray = false) {
	const dataSchema = isArray
		? { type: "array", items: { $ref: getSchemaPath(type) } }
		: { $ref: getSchemaPath(type) };

	return {
		type: "object",
		properties: {
			success: { type: "boolean", example: true },
			data: dataSchema,
			timestamp: { type: "number", example: Date.now() },
		},
		required: ["success", "data", "timestamp"],
	};
}

/**
 * 페이지네이션 응답 래퍼 스키마 생성
 * { success: true, data: { items: T[], pagination: PaginationInfo }, timestamp: number }
 */
function createPaginatedSchema<T>(type: Type<T>) {
	return {
		type: "object",
		properties: {
			success: { type: "boolean", example: true },
			data: {
				type: "object",
				properties: {
					items: {
						type: "array",
						items: { $ref: getSchemaPath(type) },
					},
					pagination: { $ref: getSchemaPath(PaginationInfoSchema) },
				},
				required: ["items", "pagination"],
			},
			timestamp: { type: "number", example: Date.now() },
		},
		required: ["success", "data", "timestamp"],
	};
}

/**
 * 성공 응답 데코레이터 (HTTP 200)
 *
 * 실제 응답 래퍼 구조를 Swagger에 반영합니다.
 * { success: true, data: T, timestamp: number }
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiSuccessResponse({ type: TodoResponseDto })
 * findById(@Param('id') id: number) { ... }
 *
 * @Get()
 * @ApiSuccessResponse({ type: TodoResponseDto, isArray: true })
 * findAll() { ... }
 * ```
 */
export function ApiSuccessResponse<T>(
	options: ApiSuccessResponseOptions<T>,
): MethodDecorator {
	const {
		status = HttpStatus.OK,
		description = SWAGGER_DESCRIPTION.SUCCESS_200,
		type,
		isArray = false,
	} = options;

	return applyDecorators(
		ApiExtraModels(type),
		ApiResponse({
			status,
			description,
			schema: createSuccessSchema(type, isArray),
		}),
	);
}

/**
 * 생성 응답 데코레이터 (HTTP 201)
 *
 * @example
 * ```typescript
 * @Post()
 * @ApiCreatedResponse({ type: TodoResponseDto })
 * create(@Body() dto: CreateTodoDto) { ... }
 * ```
 */
export function ApiCreatedResponse<T>(
	options: ApiCreatedResponseOptions<T>,
): MethodDecorator {
	const { description = SWAGGER_DESCRIPTION.CREATED_201, type } = options;

	return applyDecorators(
		ApiExtraModels(type),
		ApiResponse({
			status: HttpStatus.CREATED,
			description,
			schema: createSuccessSchema(type, false),
		}),
	);
}

/**
 * 페이지네이션 응답 데코레이터
 *
 * 페이지네이션 응답 구조를 Swagger에 반영합니다.
 * { success: true, data: { items: T[], pagination: PaginationInfo }, timestamp: number }
 *
 * @example
 * ```typescript
 * @Get()
 * @ApiPaginatedResponse({ type: TodoResponseDto })
 * findAll(@Query() query: PaginationDto) { ... }
 * ```
 */
export function ApiPaginatedResponse<T>(
	options: ApiPaginatedResponseOptions<T>,
): MethodDecorator {
	const { description = SWAGGER_DESCRIPTION.SUCCESS_200, type } = options;

	return applyDecorators(
		ApiExtraModels(type, PaginationInfoSchema),
		ApiResponse({
			status: HttpStatus.OK,
			description,
			schema: createPaginatedSchema(type),
		}),
	);
}

/**
 * No Content 응답 데코레이터 (HTTP 204)
 *
 * @example
 * ```typescript
 * @Delete(':id')
 * @ApiNoContentResponse()
 * delete(@Param('id') id: number) { ... }
 * ```
 */
export function ApiNoContentResponse(description?: string): MethodDecorator {
	return applyDecorators(
		ApiResponse({
			status: HttpStatus.NO_CONTENT,
			description: description ?? SWAGGER_DESCRIPTION.NO_CONTENT_204,
		}),
	);
}

/**
 * 커서 기반 페이지네이션 응답 래퍼 스키마 생성
 * { success: true, data: { items: T[], pagination: CursorPaginationInfo }, timestamp: number }
 */
function createCursorPaginatedSchema<T>(type: Type<T>) {
	return {
		type: "object",
		properties: {
			success: { type: "boolean", example: true },
			data: {
				type: "object",
				properties: {
					items: {
						type: "array",
						items: { $ref: getSchemaPath(type) },
					},
					pagination: { $ref: getSchemaPath(CursorPaginationInfoSchema) },
				},
				required: ["items", "pagination"],
			},
			timestamp: { type: "number", example: Date.now() },
		},
		required: ["success", "data", "timestamp"],
	};
}

/**
 * 커서 기반 페이지네이션 응답 데코레이터
 *
 * 커서 기반 페이지네이션 응답 구조를 Swagger에 반영합니다.
 * { success: true, data: { items: T[], pagination: CursorPaginationInfo }, timestamp: number }
 *
 * @example
 * ```typescript
 * @Get('cursor')
 * @ApiCursorPaginatedResponse({ type: TodoResponseDto })
 * findAllCursor(@Query() query: CursorPaginationDto) { ... }
 * ```
 */
export function ApiCursorPaginatedResponse<T>(
	options: ApiPaginatedResponseOptions<T>,
): MethodDecorator {
	const { description = SWAGGER_DESCRIPTION.SUCCESS_200, type } = options;

	return applyDecorators(
		ApiExtraModels(type, CursorPaginationInfoSchema),
		ApiResponse({
			status: HttpStatus.OK,
			description,
			schema: createCursorPaginatedSchema(type),
		}),
	);
}

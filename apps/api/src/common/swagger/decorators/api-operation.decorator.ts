import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";

import { SWAGGER_DESCRIPTION } from "../constants/swagger.constant";
import type { ApiDocOptions } from "../interfaces/swagger.interface";
import { ErrorResponseSchema } from "../schemas/response.schema";

/**
 * API 문서화를 위한 통합 데코레이터
 *
 * 기능:
 * - ApiOperation (summary, description, deprecated) 설정
 * - 공통 에러 응답 (400, 500) 자동 추가 (옵션)
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiDoc({ summary: 'Todo 상세 조회' })
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiDoc(options: ApiDocOptions): MethodDecorator {
	const {
		summary,
		description,
		operationId,
		deprecated,
		includeCommonErrors = true,
	} = options;

	const decorators: Array<
		ClassDecorator | MethodDecorator | PropertyDecorator
	> = [
		ApiOperation({
			summary,
			description,
			operationId,
			deprecated,
		}),
	];

	if (includeCommonErrors) {
		decorators.push(
			ApiResponse({
				status: HttpStatus.BAD_REQUEST,
				description: SWAGGER_DESCRIPTION.BAD_REQUEST_400,
				type: ErrorResponseSchema,
			}),
			ApiResponse({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				description: SWAGGER_DESCRIPTION.INTERNAL_ERROR_500,
				type: ErrorResponseSchema,
			}),
		);
	}

	return applyDecorators(...decorators);
}

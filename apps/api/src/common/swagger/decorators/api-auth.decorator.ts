import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse } from "@nestjs/swagger";

import {
	SWAGGER_DESCRIPTION,
	SWAGGER_SECURITY,
} from "../constants/swagger.constant";
import { ErrorResponseSchema } from "../schemas/response.schema";

/**
 * 인증 필수 엔드포인트 표시 데코레이터
 *
 * 기능:
 * - ApiBearerAuth (access-token) 설정
 * - 401 Unauthorized 응답 자동 추가
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @ApiAuthRequired()
 * getProfile() { ... }
 * ```
 */
export function ApiAuthRequired(): MethodDecorator {
	return applyDecorators(
		ApiBearerAuth(SWAGGER_SECURITY.ACCESS_TOKEN),
		ApiResponse({
			status: HttpStatus.UNAUTHORIZED,
			description: SWAGGER_DESCRIPTION.UNAUTHORIZED_401,
			type: ErrorResponseSchema,
		}),
	);
}

/**
 * 리프레시 토큰 필수 엔드포인트 표시 데코레이터
 *
 * @example
 * ```typescript
 * @Post('refresh')
 * @ApiRefreshTokenRequired()
 * refreshToken() { ... }
 * ```
 */
export function ApiRefreshTokenRequired(): MethodDecorator {
	return applyDecorators(
		ApiBearerAuth(SWAGGER_SECURITY.REFRESH_TOKEN),
		ApiResponse({
			status: HttpStatus.UNAUTHORIZED,
			description: SWAGGER_DESCRIPTION.UNAUTHORIZED_401,
			type: ErrorResponseSchema,
		}),
	);
}

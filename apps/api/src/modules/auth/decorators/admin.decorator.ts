import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../guards/admin.guard";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

export const IS_ADMIN_KEY = "isAdmin";

/**
 * 관리자 전용 라우트를 표시하는 데코레이터
 *
 * JwtAuthGuard와 AdminGuard를 자동으로 적용합니다.
 * role이 ADMIN인 사용자만 접근할 수 있습니다.
 *
 * @example
 * ```typescript
 * @Admin()
 * @Get('users')
 * async getAllUsers() {
 *   return this.userService.findAll();
 * }
 * ```
 */
export function Admin() {
	return applyDecorators(
		SetMetadata(IS_ADMIN_KEY, true),
		UseGuards(JwtAuthGuard, AdminGuard),
	);
}

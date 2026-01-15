import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

import type { CurrentUserPayload } from "../strategies/jwt.strategy";

/**
 * JWT 토큰에서 추출된 현재 사용자 정보를 주입하는 데코레이터
 *
 * @example
 * ```typescript
 * @Get('me')
 * async getMe(@CurrentUser() user: CurrentUserPayload) {
 *   return user;
 * }
 *
 * // 특정 속성만 추출
 * @Get('profile')
 * async getProfile(@CurrentUser('userId') userId: string) {
 *   return this.userService.findById(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
	(data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<Request>();
		const user = request.user as CurrentUserPayload | undefined;

		if (!user) {
			return undefined;
		}

		return data ? user[data] : user;
	},
);

// 타입 재export (이름 변경으로 충돌 방지)
export type { CurrentUserPayload };

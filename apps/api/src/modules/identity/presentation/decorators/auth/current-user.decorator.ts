import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { CurrentUserPayload } from "#api/modules/identity/infrastructure/strategies/auth/jwt.strategy";

import { authenticatedUserSchema } from "./authenticated-user.schema.js";

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
    const parsedUser = authenticatedUserSchema.safeParse(request.user);

    if (!parsedUser.success) {
      return undefined;
    }

    return data ? parsedUser.data[data] : parsedUser.data;
  },
);

// 타입 재export (이름 변경으로 충돌 방지)
export type { CurrentUserPayload };

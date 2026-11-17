import type { CurrentUserPayload } from "@aido/api/contracts/auth/v1";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { HttpRequest } from "#api/platform/http/http-request";

import { authenticatedUserSchema } from "./authenticated-user.dto.js";

/**
 * JWT 토큰에서 추출된 현재 사용자 정보를 주입하는 데코레이터
 *
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
  (data: keyof CurrentUserPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const parsedUser = authenticatedUserSchema.safeParse(request.user);

    if (!parsedUser.success) {
      return undefined;
    }

    return data ? parsedUser.data[data] : parsedUser.data;
  },
);

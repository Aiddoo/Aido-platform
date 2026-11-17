import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { HttpRequest } from "#api/platform/http/http-request";

import { invalidRefreshToken } from "../../../application/sessions.errors.js";
import { type RefreshTokenUser, refreshTokenUserSchema } from "./authenticated-user.dto.js";

/** `@CurrentRefreshUser() user: RefreshTokenUser` — JwtRefreshGuard가 확인한 사용자와 원본 refresh 토큰 */
export const CurrentRefreshUser = createParamDecorator<undefined, RefreshTokenUser>(
  (_data, context: ExecutionContext) => {
    const parsed = refreshTokenUserSchema.safeParse(
      context.switchToHttp().getRequest<HttpRequest>().user,
    );
    if (!parsed.success) {
      throw invalidRefreshToken();
    }
    return parsed.data;
  },
);

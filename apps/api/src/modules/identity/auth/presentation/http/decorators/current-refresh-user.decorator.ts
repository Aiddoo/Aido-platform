import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { invalidRefreshToken } from "../../../application/auth.errors.js";
import { type RefreshTokenUser, refreshTokenUserSchema } from "./authenticated-user.dto.js";

/** `@CurrentRefreshUser() user: RefreshTokenUser` — JwtRefreshGuard가 확인한 사용자와 원본 refresh 토큰 */
export const CurrentRefreshUser = createParamDecorator<undefined, RefreshTokenUser>(
  (_data, context: ExecutionContext) => {
    const parsed = refreshTokenUserSchema.safeParse(
      context.switchToHttp().getRequest<Request>().user,
    );
    if (!parsed.success) {
      throw invalidRefreshToken();
    }
    return parsed.data;
  },
);

import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { adminRequired, invalidAccessToken } from "../../../application/auth.errors.js";

/**
 * 관리자 전용 가드
 *
 * JwtAuthGuard 이후에 실행되어 사용자의 role이 ADMIN인지 확인합니다.
 * @Admin() 데코레이터가 적용된 라우트에서 사용됩니다.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * @Admin()
 * @Get('admin/users')
 * async getUsers() { ... }
 * ```
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUserPayload }>();
    const user = request.user;

    if (!user) {
      throw invalidAccessToken("User information not found");
    }

    if (user.role !== "ADMIN") {
      throw adminRequired();
    }

    return true;
  }
}

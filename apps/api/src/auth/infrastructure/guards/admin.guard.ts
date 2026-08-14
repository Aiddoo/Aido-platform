import { ErrorCode } from "@aido/errors";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

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
	constructor(readonly _reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request & { user?: CurrentUserPayload }>();
		const user = request.user;

		if (!user) {
			throw new ApplicationException(ErrorCode.AUTH_0101, {
				reason: "User information not found",
			});
		}

		if (user.role !== "ADMIN") {
			throw new ApplicationException(ErrorCode.ADMIN_1401);
		}

		return true;
	}
}

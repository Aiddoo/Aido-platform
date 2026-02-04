import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import type { CurrentUserPayload } from "../decorators";

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
		const request = context.switchToHttp().getRequest<Request>();
		const user = request.user as CurrentUserPayload | undefined;

		if (!user) {
			throw BusinessExceptions.invalidToken({
				reason: "User information not found",
			});
		}

		if (user.role !== "ADMIN") {
			throw BusinessExceptions.adminRequired();
		}

		return true;
	}
}

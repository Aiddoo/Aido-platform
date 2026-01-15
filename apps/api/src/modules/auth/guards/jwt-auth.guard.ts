import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * JWT Access Token 인증 가드
 *
 * @Public() 데코레이터가 적용된 라우트는 인증을 건너뜀
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	override canActivate(context: ExecutionContext) {
		// @Public() 데코레이터가 있으면 인증 건너뛰기
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		return super.canActivate(context);
	}

	override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
		if (err || !user) {
			throw BusinessExceptions.invalidToken({
				reason: err?.message || "Access token is missing or invalid",
			});
		}
		return user;
	}
}

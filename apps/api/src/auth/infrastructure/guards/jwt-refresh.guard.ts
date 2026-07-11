import { ErrorCode } from "@aido/errors";
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

/**
 * JWT Refresh Token 인증 가드
 *
 * 토큰 갱신 엔드포인트에서만 사용
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {
	override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
		if (err || !user) {
			throw new ApplicationException(ErrorCode.AUTH_0104);
		}
		return user;
	}
}

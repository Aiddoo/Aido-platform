import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

/**
 * JWT Refresh Token 인증 가드
 *
 * 토큰 갱신 엔드포인트에서만 사용
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {
	override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
		if (err || !user) {
			throw BusinessExceptions.refreshTokenInvalid();
		}
		return user;
	}
}

import type { CurrentUserPayload } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { TypedConfigService } from "@/common/config/services/config.service";
import { now } from "@/common/date";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { SessionRepository } from "../repositories/session.repository";
import type { JwtPayload } from "../services/token.service";

/**
 * @aido/validators에서 re-export (하위 호환성 유지)
 */
export type { CurrentUserPayload };

/**
 * JWT Access Token Strategy
 *
 * Authorization: Bearer <access_token> 헤더에서 토큰을 추출하여 검증합니다.
 * Access Token이 유효하더라도 세션이 폐기되었거나 만료된 경우 접근을 거부합니다.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
	constructor(
		readonly configService: TypedConfigService,
		private readonly sessionRepository: SessionRepository,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get("JWT_SECRET"),
		});
	}

	/**
	 * JWT 페이로드 검증 및 사용자 정보 반환
	 *
	 * Passport가 자동으로 호출하며, 반환값이 req.user에 할당됩니다.
	 * 세션 상태를 DB에서 검증하여 로그아웃/세션 폐기 후 토큰 사용을 방지합니다.
	 */
	async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
		// Access Token 타입 확인
		if (payload.type !== "access") {
			throw BusinessExceptions.invalidToken({ reason: "Not an access token" });
		}

		// sessionId 필수 확인
		if (!payload.sessionId) {
			throw BusinessExceptions.invalidToken({ reason: "Missing sessionId" });
		}

		// 세션 유효성 DB 검증 - 로그아웃 후 토큰 사용 방지
		const session = await this.sessionRepository.findById(payload.sessionId);

		if (!session) {
			throw BusinessExceptions.sessionNotFound();
		}

		if (session.revokedAt) {
			throw BusinessExceptions.sessionRevoked();
		}

		if (session.expiresAt < now()) {
			throw BusinessExceptions.sessionExpired();
		}

		return {
			userId: payload.sub,
			email: payload.email,
			sessionId: payload.sessionId,
		};
	}
}

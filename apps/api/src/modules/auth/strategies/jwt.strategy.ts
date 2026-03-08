import type { CurrentUserPayload } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import { toISOStringOrNull } from "@/common/date/utils/format";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { SessionService } from "../services/session.service";
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
		private readonly sessionService: SessionService,
		private readonly cacheService: CacheService,
		private readonly userRepository: UserRepository,
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
	 * 캐시-aside 패턴으로 세션 상태를 검증하여 로그아웃/세션 폐기 후 토큰 사용을 방지합니다.
	 *
	 * 캐시 전략:
	 * - TTL: 30초 (보안과 성능의 균형)
	 * - 캐시 히트: DB 조회 없이 즉시 반환
	 * - 캐시 미스: DB 조회 → 유효성 검증 → 캐시 저장
	 * - 무효화: 로그아웃/세션 폐기 시 즉시 삭제
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

		// 1. 캐시에서 세션 조회 (캐시-aside 패턴)
		const cachedSession = await this.cacheService.getSession(payload.sessionId);

		if (cachedSession) {
			// 캐시 히트: 캐시된 데이터로 유효성 검증
			this.sessionService.assertSessionValid(cachedSession, payload.sessionId);

			// Defense in Depth: 캐시된 사용자 상태 검증
			if (cachedSession.userStatus) {
				this.#assertUserStatus(
					cachedSession.userStatus,
					cachedSession.userDeletedAt,
				);
			}

			return {
				userId: payload.sub,
				email: payload.email,
				sessionId: payload.sessionId,
				role: payload.role,
			};
		}

		// 2. 캐시 미스: DB에서 세션 조회
		const session = await this.sessionRepository.findById(payload.sessionId);
		this.sessionService.assertSessionValid(session, payload.sessionId);

		// 3. 사용자 상태 조회 (Defense in Depth)
		const user = await this.userRepository.findById(session.userId);

		const userStatus = user?.status;
		const userDeletedAt = toISOStringOrNull(user?.deletedAt ?? null);

		if (userStatus) {
			this.#assertUserStatus(userStatus, userDeletedAt);
		}

		// 4. 유효한 세션을 캐시에 저장 (30초 TTL) — 사용자 상태 포함
		await this.cacheService.setSession(payload.sessionId, {
			userId: session.userId,
			expiresAt: session.expiresAt,
			revokedAt: session.revokedAt,
			userStatus,
			userDeletedAt,
		});

		return {
			userId: payload.sub,
			email: payload.email,
			sessionId: payload.sessionId,
			role: payload.role,
		};
	}

	/**
	 * 사용자 상태 검증 (Defense in Depth)
	 *
	 * 세션이 유효하더라도 사용자가 잠금/정지/탈퇴 상태이면 접근을 거부합니다.
	 */
	#assertUserStatus(status: string, deletedAt?: string | null): void {
		if (status === "LOCKED") {
			throw BusinessExceptions.accountLocked("User");
		}
		if (status === "SUSPENDED" || deletedAt) {
			throw BusinessExceptions.accountSuspended("User");
		}
	}
}

import { ErrorCode } from "@aido/errors";
import type { UserRole } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { TokenPair } from "@/auth/infrastructure/adapters/token.service";
import { TokenService } from "@/auth/infrastructure/adapters/token.service";
import { SessionRepository } from "@/auth/infrastructure/persistence/session.repository";
import { addMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import { isExpired } from "@/shared/domain/date/utils/compare";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

export interface CreateSessionParams {
	userId: string;
	email: string;
	role: UserRole;
	deviceFingerprint: string;
	userAgent: string;
	ipAddress: string;
}

export interface CreateSessionResult {
	sessionId: string;
	tokens: TokenPair;
	tokenFamily: string;
}

/**
 * 세션 유효성 검증에 필요한 최소 데이터
 * DB Session과 CachedSession 모두 호환
 */
export interface SessionValidatable {
	revokedAt: Date | string | null;
	expiresAt: Date | string;
}

/**
 * 세션 생성 + 토큰 발급 + refreshTokenHash 업데이트를 통합하는 서비스
 *
 * AuthService.verifyEmail, AuthService.login, OAuthService._createSessionAndTokens에서
 * 동일하게 반복되던 5단계 시퀀스를 단일 메서드로 제공합니다.
 */
@Injectable()
export class SessionService {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly tokenService: TokenService,
	) {}

	/**
	 * 세션 생성 → 토큰 발급 → refreshTokenHash 업데이트를 원자적으로 수행
	 *
	 * 트랜잭션은 CLS로 전파된다 — 호출측이 uow.run으로 연 트랜잭션에 참여한다.
	 *
	 * @param params 세션 생성에 필요한 사용자/디바이스 정보
	 */
	async createSessionWithTokens(
		params: CreateSessionParams,
	): Promise<CreateSessionResult> {
		const tokenFamily = this.tokenService.generateTokenFamily();

		const expiresInSeconds =
			this.tokenService.getRefreshTokenExpiresInSeconds();
		const expiresAt = addMilliseconds(expiresInSeconds * 1000);

		// 1. 세션 생성 (refreshTokenHash 없이)
		const session = await this.sessionRepository.create({
			userId: params.userId,
			tokenFamily,
			tokenVersion: 1,
			deviceFingerprint: params.deviceFingerprint,
			userAgent: params.userAgent,
			ipAddress: params.ipAddress,
			expiresAt,
		});

		// 2. 실제 세션 ID로 토큰 발급
		const tokens = await this.tokenService.generateTokenPair(
			params.userId,
			params.email,
			session.id,
			params.role,
			tokenFamily,
			1,
		);

		// 3. refreshTokenHash로 세션 업데이트
		const refreshTokenHash = this.tokenService.hashRefreshToken(
			tokens.refreshToken,
		);
		await this.sessionRepository.updateRefreshTokenHash(
			session.id,
			refreshTokenHash,
		);

		return {
			sessionId: session.id,
			tokens,
			tokenFamily,
		};
	}

	/**
	 * 세션 유효성을 검증하고, 유효하지 않으면 ApplicationException을 던진다
	 *
	 * @throws sessionNotFound - 세션이 존재하지 않음
	 * @throws sessionRevoked - 세션이 폐기됨
	 * @throws sessionExpired - 세션이 만료됨
	 */
	assertSessionValid(
		session: SessionValidatable | null | undefined,
		sessionId?: string,
	): asserts session is SessionValidatable {
		if (!session) {
			throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId });
		}

		if (session.revokedAt) {
			throw new ApplicationException(ErrorCode.SESSION_0703, {
				sessionId,
				reason: undefined,
			});
		}

		const expiresAt =
			session.expiresAt instanceof Date
				? session.expiresAt
				: new Date(session.expiresAt);

		if (isExpired(expiresAt)) {
			throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId });
		}
	}
}

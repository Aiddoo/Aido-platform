import type { UserRole } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { addMilliseconds } from "@/common/date";
import type { Prisma } from "@/generated/prisma/client";

import { SessionRepository } from "../repositories/session.repository";
import type { TokenPair } from "./token.service";
import { TokenService } from "./token.service";

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
	 * @param params 세션 생성에 필요한 사용자/디바이스 정보
	 * @param tx 트랜잭션 클라이언트 (선택)
	 */
	async createSessionWithTokens(
		params: CreateSessionParams,
		tx?: Prisma.TransactionClient,
	): Promise<CreateSessionResult> {
		const tokenFamily = this.tokenService.generateTokenFamily();

		const expiresInSeconds =
			this.tokenService.getRefreshTokenExpiresInSeconds();
		const expiresAt = addMilliseconds(expiresInSeconds * 1000);

		// 1. 세션 생성 (refreshTokenHash 없이)
		const session = await this.sessionRepository.create(
			{
				userId: params.userId,
				tokenFamily,
				tokenVersion: 1,
				deviceFingerprint: params.deviceFingerprint,
				userAgent: params.userAgent,
				ipAddress: params.ipAddress,
				expiresAt,
			},
			tx,
		);

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
			tx,
		);

		return {
			sessionId: session.id,
			tokens,
			tokenFamily,
		};
	}
}

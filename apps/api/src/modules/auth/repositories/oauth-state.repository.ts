import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { addMinutes, now } from "@/common/date/utils";
import { DatabaseService } from "@/database";
import type { AccountProvider, OAuthState } from "@/generated/prisma/client";

/**
 * OAuth State Repository
 *
 * CSRF/PKCE state 관리 및 일회용 교환 코드 관리를 담당합니다.
 * OAuthState 테이블을 사용하여 두 가지 역할을 수행합니다:
 * 1. OAuth 인증 시작 시: state(CSRF 토큰), codeVerifier(PKCE) 저장
 * 2. OAuth 인증 완료 시: exchangeCode, 암호화된 토큰, 사용자 정보 저장
 */
@Injectable()
export class OAuthStateRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * OAuth State 생성 (인증 시작 시)
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @param provider - OAuth 제공자
	 * @param redirectUri - 리다이렉트 URI
	 * @param codeVerifier - PKCE code verifier (선택)
	 * @param expiresInMinutes - 만료 시간 (기본 10분)
	 */
	async create(
		state: string,
		provider: AccountProvider,
		redirectUri: string,
		options?: {
			codeVerifier?: string;
			ipAddress?: string;
			userAgent?: string;
			expiresInMinutes?: number;
		},
	): Promise<OAuthState> {
		const expiresAt = addMinutes(options?.expiresInMinutes ?? 10);

		return this.database.oAuthState.create({
			data: {
				state,
				provider,
				redirectUri,
				codeVerifier: options?.codeVerifier,
				ipAddress: options?.ipAddress,
				userAgent: options?.userAgent,
				expiresAt,
			},
		});
	}

	async findByState(state: string): Promise<OAuthState | null> {
		return this.database.oAuthState.findFirst({
			where: {
				state,
				expiresAt: { gt: now() },
			},
		});
	}

	// 아직 교환되지 않은 (exchangedAt이 null인) 레코드만 반환
	async findByExchangeCode(exchangeCode: string): Promise<OAuthState | null> {
		return this.database.oAuthState.findFirst({
			where: {
				exchangeCode,
				exchangedAt: null, // 아직 교환되지 않은 것만
				expiresAt: { gt: now() },
			},
		});
	}

	async saveExchangeData(
		id: number,
		data: {
			exchangeCode: string;
			accessToken: string;
			refreshToken: string;
			userId: string;
			userName?: string;
			profileImage?: string;
		},
	): Promise<OAuthState> {
		return this.database.oAuthState.update({
			where: { id },
			data: {
				exchangeCode: data.exchangeCode,
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				userId: data.userId,
				userName: data.userName,
				profileImage: data.profileImage,
			},
		});
	}

	// 교환 완료 후 보안을 위해 토큰 삭제
	async markAsExchanged(id: number): Promise<OAuthState> {
		return this.database.oAuthState.update({
			where: { id },
			data: {
				exchangedAt: now(),
				// 교환 완료 후 토큰 삭제 (보안)
				accessToken: null,
				refreshToken: null,
			},
		});
	}

	async delete(id: number): Promise<void> {
		await this.database.oAuthState.delete({
			where: { id },
		});
	}

	async deleteExpired(): Promise<number> {
		const result = await this.database.oAuthState.deleteMany({
			where: {
				expiresAt: { lt: now() },
			},
		});
		return result.count;
	}

	generateExchangeCode(): string {
		return randomBytes(32).toString("base64url");
	}
}

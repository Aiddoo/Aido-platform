import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";

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
		const expiresAt = new Date(
			Date.now() + (options?.expiresInMinutes ?? 10) * 60 * 1000,
		);

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

	/**
	 * State로 OAuth State 조회 (유효성 검증 포함)
	 */
	async findByState(state: string): Promise<OAuthState | null> {
		return this.database.oAuthState.findFirst({
			where: {
				state,
				expiresAt: { gt: new Date() },
			},
		});
	}

	/**
	 * 교환 코드로 OAuth State 조회 (유효성 검증 포함)
	 * 아직 교환되지 않은 (exchangedAt이 null인) 레코드만 반환
	 */
	async findByExchangeCode(exchangeCode: string): Promise<OAuthState | null> {
		return this.database.oAuthState.findFirst({
			where: {
				exchangeCode,
				exchangedAt: null, // 아직 교환되지 않은 것만
				expiresAt: { gt: new Date() },
			},
		});
	}

	/**
	 * OAuth 인증 성공 후 교환 코드 및 토큰 저장
	 *
	 * State를 기반으로 해당 레코드에 교환 코드와 암호화된 토큰을 저장합니다.
	 */
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

	/**
	 * 교환 완료 처리 (exchangedAt 설정 및 토큰 삭제)
	 *
	 * 교환 완료 후 보안을 위해 토큰을 삭제합니다.
	 */
	async markAsExchanged(id: number): Promise<OAuthState> {
		return this.database.oAuthState.update({
			where: { id },
			data: {
				exchangedAt: new Date(),
				// 교환 완료 후 토큰 삭제 (보안)
				accessToken: null,
				refreshToken: null,
			},
		});
	}

	/**
	 * State 삭제 (인증 완료 또는 만료 시)
	 */
	async delete(id: number): Promise<void> {
		await this.database.oAuthState.delete({
			where: { id },
		});
	}

	/**
	 * 만료된 State 일괄 삭제 (정리 작업)
	 */
	async deleteExpired(): Promise<number> {
		const result = await this.database.oAuthState.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
		return result.count;
	}

	/**
	 * 랜덤 교환 코드 생성 (URL-safe)
	 */
	generateExchangeCode(): string {
		return randomBytes(32).toString("base64url");
	}
}

import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OAuthMode } from "@/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider, OAuthState } from "@/generated/prisma/client";
import { addMinutes } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { DatabaseService } from "@/shared/infrastructure/database";
import { EncryptionService } from "@/shared/infrastructure/encryption";

export type { OAuthMode };

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
	constructor(
		private readonly database: DatabaseService,
		private readonly encryptionService: EncryptionService,
	) {}

	/**
	 * OAuth State 생성 (인증 시작 시)
	 *
	 * @param state - CSRF 방지용 상태 값
	 * @param provider - OAuth 제공자
	 * @param redirectUri - 리다이렉트 URI
	 * @param options.mode - 'login' | 'link' (미지정 시 null = login)
	 * @param options.codeVerifier - PKCE code verifier (선택)
	 * @param options.expiresInMinutes - 만료 시간 (기본 10분)
	 */
	async create(
		state: string,
		provider: AccountProvider,
		redirectUri: string,
		options?: {
			mode?: OAuthMode;
			codeVerifier?: string;
			ipAddress?: string;
			userAgent?: string;
			expiresInMinutes?: number;
			initiatingUserId?: string;
		},
	): Promise<OAuthState> {
		const expiresAt = addMinutes(options?.expiresInMinutes ?? 10);

		return this.database.oAuthState.create({
			data: {
				state,
				provider,
				redirectUri,
				mode: options?.mode,
				codeVerifier: options?.codeVerifier,
				ipAddress: options?.ipAddress,
				userAgent: options?.userAgent,
				initiatingUserId: options?.initiatingUserId,
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
			accountRestored?: boolean;
		},
	): Promise<OAuthState> {
		return this.database.oAuthState.update({
			where: { id },
			data: {
				exchangeCode: data.exchangeCode,
				accessToken: this.encryptionService.encrypt(data.accessToken),
				refreshToken: this.encryptionService.encrypt(data.refreshToken),
				userId: data.userId,
				userName: data.userName,
				profileImage: data.profileImage,
				accountRestored: data.accountRestored,
			},
		});
	}

	/**
	 * 계정 연결(link) 모드 교환 데이터 저장
	 *
	 * login 모드와 달리 accessToken/refreshToken 대신
	 * providerAccountId를 userId 필드에 임시 저장합니다.
	 */
	async saveLinkingData(
		id: number,
		data: {
			exchangeCode: string;
			provider: AccountProvider;
			providerAccountId: string;
		},
	): Promise<OAuthState> {
		return this.database.oAuthState.update({
			where: { id },
			data: {
				exchangeCode: data.exchangeCode,
				provider: data.provider,
				userId: data.providerAccountId, // providerAccountId를 userId 필드에 임시 저장
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

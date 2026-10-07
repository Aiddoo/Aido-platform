import { randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import type { AuthOAuthStateRecord } from "#api/auth/application/ports/auth-persistence.port";
import type { OAuthMode } from "#api/auth/application/ports/oauth-identity-provider.port";
import { addMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import {
	decodeRecord,
	encodeCreate,
	encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp, varchar } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import type {
	AccountProvider,
	OAuthState,
} from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import { EncryptionService } from "#api/shared/infrastructure/encryption/index";

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

		return this.database.db.orm.public.OAuthState.create(
			encodeCreate("OAuthState", {
				state,
				provider,
				redirectUri,
				mode: options?.mode,
				codeVerifier: options?.codeVerifier,
				ipAddress: options?.ipAddress,
				userAgent: options?.userAgent,
				initiatingUserId: options?.initiatingUserId,
				expiresAt,
			}),
		).then((row) => decodeRecord("OAuthState", row));
	}

	async findByState(state: string): Promise<OAuthState | null> {
		return this.database.db.orm.public.OAuthState.where((row) =>
			and(row.state.eq(varchar(state, 64)), row.expiresAt.gt(databaseTimestamp(now()))),
		)
			.first()
			.then((row) => decodeRecord("OAuthState", row));
	}

	// 아직 교환되지 않은 (exchangedAt이 null인) 레코드만 반환
	async findByExchangeCode(exchangeCode: string): Promise<AuthOAuthStateRecord | null> {
		const state = decodeRecord(
			"OAuthState",
			await this.database.db.orm.public.OAuthState.where((row) =>
				and(
					row.exchangeCode.eq(varchar(exchangeCode, 64)),
					row.exchangedAt.isNull(),
					row.expiresAt.gt(databaseTimestamp(now())),
				),
			).first(),
		);
		if (!state) {
			return null;
		}
		return {
			id: state.id,
			state: state.state,
			provider: state.provider,
			redirectUri: state.redirectUri,
			mode: state.mode,
			initiatingUserId: state.initiatingUserId,
			exchangeCode: state.exchangeCode,
			accessToken: state.accessToken ? this.encryptionService.decryptSafe(state.accessToken) : null,
			refreshToken: state.refreshToken
				? this.encryptionService.decryptSafe(state.refreshToken)
				: null,
			userId: state.userId,
			userName: state.userName,
			profileImage: state.profileImage,
			accountRestored: state.accountRestored,
		};
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
		return this.database.db.orm.public.OAuthState.where((row) => row.id.eq(id))
			.update(
				encodePatch("OAuthState", {
					exchangeCode: data.exchangeCode,
					accessToken: this.encryptionService.encrypt(data.accessToken),
					refreshToken: this.encryptionService.encrypt(data.refreshToken),
					userId: data.userId,
					userName: data.userName,
					profileImage: data.profileImage,
					accountRestored: data.accountRestored,
				}),
			)
			.then((row) => decodeRecord("OAuthState", requireRecord(row)));
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
		return this.database.db.orm.public.OAuthState.where((row) => row.id.eq(id))
			.update(
				encodePatch("OAuthState", {
					exchangeCode: data.exchangeCode,
					provider: data.provider,
					userId: data.providerAccountId, // providerAccountId를 userId 필드에 임시 저장
				}),
			)
			.then((row) => decodeRecord("OAuthState", requireRecord(row)));
	}

	// 교환 완료 후 보안을 위해 토큰 삭제
	async markAsExchanged(id: number): Promise<OAuthState> {
		return this.database.db.orm.public.OAuthState.where((row) => row.id.eq(id))
			.update(
				encodePatch("OAuthState", {
					exchangedAt: now(),
					// 교환 완료 후 토큰 삭제 (보안)
					accessToken: null,
					refreshToken: null,
				}),
			)
			.then((row) => decodeRecord("OAuthState", requireRecord(row)));
	}

	async delete(id: number): Promise<void> {
		decodeRecord(
			"OAuthState",
			requireRecord(
				await this.database.db.orm.public.OAuthState.where((row) => row.id.eq(id)).delete(),
			),
		);
	}

	async deleteExpired(): Promise<number> {
		const result = {
			count: await this.database.db.orm.public.OAuthState.where((row) =>
				row.expiresAt.lt(databaseTimestamp(now())),
			).deleteAndCount(),
		};
		return result.count;
	}

	generateExchangeCode(): string {
		return randomBytes(32).toString("base64url");
	}
}

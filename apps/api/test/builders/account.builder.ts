/**
 * Account 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 Credential 계정
 * const account = AccountBuilder.create('user-123').build();
 *
 * // OAuth 계정 (Kakao)
 * const kakao = AccountBuilder.create('user-123')
 *   .asKakao('kakao-provider-id')
 *   .withOAuthTokens('access-token', 'refresh-token')
 *   .build();
 *
 * // 비밀번호 포함 계정
 * const withPassword = AccountBuilder.create('user-123')
 *   .withPassword('$argon2id$...')
 *   .build();
 * ```
 */
import type { Account, AccountProvider } from "@/generated/prisma/client";

export class AccountBuilder {
	private data: Account;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		AccountBuilder.idCounter += 1;
		this.data = {
			id: AccountBuilder.idCounter,
			userId,
			provider: "CREDENTIAL" as AccountProvider,
			providerAccountId: "local",
			password: null,
			accessToken: null,
			refreshToken: null,
			accessTokenExpiresAt: null,
			scope: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	static create(userId: string): AccountBuilder {
		return new AccountBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		AccountBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): AccountBuilder {
		this.data.id = id;
		return this;
	}

	// === Provider 관련 ===

	withProvider(
		provider: AccountProvider,
		providerAccountId: string,
	): AccountBuilder {
		this.data.provider = provider;
		this.data.providerAccountId = providerAccountId;
		return this;
	}

	/** Credential 계정 (기본값) */
	asCredential(): AccountBuilder {
		this.data.provider = "CREDENTIAL";
		this.data.providerAccountId = "local";
		return this;
	}

	/** Kakao OAuth 계정 */
	asKakao(providerAccountId: string): AccountBuilder {
		this.data.provider = "KAKAO";
		this.data.providerAccountId = providerAccountId;
		this.data.password = null;
		return this;
	}

	/** Apple OAuth 계정 */
	asApple(providerAccountId: string): AccountBuilder {
		this.data.provider = "APPLE";
		this.data.providerAccountId = providerAccountId;
		this.data.password = null;
		return this;
	}

	/** Google OAuth 계정 */
	asGoogle(providerAccountId: string): AccountBuilder {
		this.data.provider = "GOOGLE";
		this.data.providerAccountId = providerAccountId;
		this.data.password = null;
		return this;
	}

	/** Naver OAuth 계정 */
	asNaver(providerAccountId: string): AccountBuilder {
		this.data.provider = "NAVER";
		this.data.providerAccountId = providerAccountId;
		this.data.password = null;
		return this;
	}

	// === 인증 정보 ===

	withPassword(hashedPassword: string): AccountBuilder {
		this.data.password = hashedPassword;
		return this;
	}

	withOAuthTokens(
		accessToken: string,
		refreshToken?: string,
		expiresAt?: Date,
	): AccountBuilder {
		this.data.accessToken = accessToken;
		this.data.refreshToken = refreshToken ?? null;
		this.data.accessTokenExpiresAt = expiresAt ?? null;
		return this;
	}

	withScope(scope: string): AccountBuilder {
		this.data.scope = scope;
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): AccountBuilder {
		this.data.createdAt = date;
		return this;
	}

	withUpdatedAt(date: Date): AccountBuilder {
		this.data.updatedAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Account {
		return { ...this.data };
	}

	/** 여러 개 생성 */
	static createMany(userId: string, count: number): Account[] {
		return Array.from({ length: count }, () =>
			AccountBuilder.create(userId).build(),
		);
	}
}

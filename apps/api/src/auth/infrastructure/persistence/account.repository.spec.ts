/**
 * AccountRepository 단위 테스트
 *
 * @description
 * 계정 저장소의 Credential/OAuth 계정 CRUD 메서드를 검증한다.
 * 트랜잭션 지원, OAuth 토큰 암호화 갱신, 계정 삭제를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test account.repository.spec.ts
 * ```
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AccountBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";

import { AuthPersistenceConflict } from "@/auth/application/ports";
import { Prisma } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { EncryptionService } from "@/shared/infrastructure/encryption";

import { AccountRepository } from "./account.repository";

describe("AccountRepository — 계정 리포지토리", () => {
	let repository: AccountRepository;
	let db: MockPrismaClient;
	let encryptionService: Mocked<EncryptionService>;

	// Builder로 기본 테스트 계정 생성
	const mockCredentialAccount = AccountBuilder.create("user-123")
		.withId(1)
		.asCredential()
		.withPassword("hashed-password")
		.withCreatedAt(new Date("2025-01-01T00:00:00Z"))
		.withUpdatedAt(new Date("2025-01-01T00:00:00Z"))
		.build();

	const mockOAuthAccount = AccountBuilder.create("user-123")
		.withId(2)
		.asGoogle("google-user-id")
		.withOAuthTokens(
			"google-access-token",
			"google-refresh-token",
			new Date("2025-02-01T00:00:00Z"),
		)
		.withScope("email profile")
		.withCreatedAt(new Date("2025-01-01T00:00:00Z"))
		.withUpdatedAt(new Date("2025-01-01T00:00:00Z"))
		.build();

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		db = createMockPrisma();

		const { unit, unitRef } = await TestBed.solitary(AccountRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
		encryptionService = unitRef.get(EncryptionService);

		// encrypt를 입력값 그대로 반환하도록 설정
		encryptionService.encrypt.mockImplementation((value: string) => value);

		// ID 카운터 리셋
		AccountBuilder.resetIdCounter();
	});

	describe("findByUserIdAndProvider", () => {
		it("사용자 ID와 제공자로 계정을 찾는다", async () => {
			// Given
			db.account.findUnique.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.findByUserIdAndProvider("user-123", "CREDENTIAL");

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(db.account.findUnique).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
			});
		});

		it("존재하지 않으면 null을 반환한다", async () => {
			// Given
			db.account.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByUserIdAndProvider("user-123", "GOOGLE");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByProviderAccountId", () => {
		it("제공자 계정 ID로 계정을 찾는다", async () => {
			// Given
			db.account.findUnique.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.findByProviderAccountId("GOOGLE", "google-user-id");

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(db.account.findUnique).toHaveBeenCalledWith({
				where: {
					provider_providerAccountId: {
						provider: "GOOGLE",
						providerAccountId: "google-user-id",
					},
				},
			});
		});

		it("존재하지 않으면 null을 반환한다", async () => {
			// Given
			db.account.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByProviderAccountId("GOOGLE", "non-existent-id");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("createCredentialAccount", () => {
		it("Credential 계정을 생성한다", async () => {
			// Given
			db.account.create.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.createCredentialAccount("user-123", "hashed-password");

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(db.account.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					provider: "CREDENTIAL",
					providerAccountId: "user-123",
					password: "hashed-password",
				},
			});
		});

		it("활성 트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			db.account.create.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.createCredentialAccount("user-123", "hashed-password");

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(db.account.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					provider: "CREDENTIAL",
					providerAccountId: "user-123",
					password: "hashed-password",
				},
			});
		});
	});

	describe("updatePassword", () => {
		it("비밀번호를 업데이트한다", async () => {
			// Given
			const updatedAccount = AccountBuilder.create("user-123")
				.withId(1)
				.asCredential()
				.withPassword("new-hashed-password")
				.withUpdatedAt(new Date("2025-01-15T00:00:00Z"))
				.build();
			db.account.update.mockResolvedValue(updatedAccount);

			// When
			const result = await repository.updatePassword("user-123", "new-hashed-password");

			// Then
			expect(result).toEqual(updatedAccount);
			expect(db.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
				data: { password: "new-hashed-password" },
			});
		});

		it("활성 트랜잭션 클라이언트를 사용하여 업데이트한다", async () => {
			// Given
			const updatedAccount = AccountBuilder.create("user-123")
				.withId(1)
				.asCredential()
				.withPassword("new-hashed-password")
				.build();
			db.account.update.mockResolvedValue(updatedAccount);

			// When
			const result = await repository.updatePassword("user-123", "new-hashed-password");

			// Then
			expect(result).toEqual(updatedAccount);
			expect(db.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
				data: { password: "new-hashed-password" },
			});
		});
	});

	describe("createOAuthAccount", () => {
		const oAuthData = {
			userId: "user-123",
			provider: "GOOGLE" as const,
			providerAccountId: "google-user-id",
			accessToken: "google-access-token",
			refreshToken: "google-refresh-token",
			accessTokenExpiresAt: new Date("2025-02-01T00:00:00Z"),
			scope: "email profile",
		};

		it("OAuth 계정을 생성한다", async () => {
			// Given
			db.account.create.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.createOAuthAccount(oAuthData);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(db.account.create).toHaveBeenCalledWith({
				data: {
					userId: oAuthData.userId,
					provider: oAuthData.provider,
					providerAccountId: oAuthData.providerAccountId,
					accessToken: oAuthData.accessToken,
					refreshToken: oAuthData.refreshToken,
					accessTokenExpiresAt: oAuthData.accessTokenExpiresAt,
					scope: oAuthData.scope,
				},
			});
		});

		it("최소 필수 정보로 OAuth 계정을 생성한다", async () => {
			// Given
			const minimalData = {
				userId: "user-123",
				provider: "APPLE" as const,
				providerAccountId: "apple-user-id",
			};
			const minimalAccount = AccountBuilder.create("user-123")
				.withId(2)
				.asApple("apple-user-id")
				.build();
			db.account.create.mockResolvedValue(minimalAccount);

			// When
			const result = await repository.createOAuthAccount(minimalData);

			// Then
			expect(result).toEqual(minimalAccount);
			expect(db.account.create).toHaveBeenCalledWith({
				data: {
					userId: minimalData.userId,
					provider: minimalData.provider,
					providerAccountId: minimalData.providerAccountId,
					accessToken: undefined,
					refreshToken: undefined,
					accessTokenExpiresAt: undefined,
					scope: undefined,
				},
			});
		});

		it("활성 트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			db.account.create.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.createOAuthAccount(oAuthData);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(db.account.create).toHaveBeenCalled();
		});

		it("OAuth 계정 유니크 충돌을 애플리케이션 경계 오류로 변환한다", async () => {
			// Given - 동일 provider 계정 연결이 동시에 완료된 상황
			db.account.create.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
					code: "P2002",
					clientVersion: "7.0.0",
				}),
			);

			// When / Then - Prisma 오류가 애플리케이션으로 누출되지 않음
			await expect(
				repository.createOAuthAccount(oAuthData),
			).rejects.toMatchObject<AuthPersistenceConflict>({
				name: "AuthPersistenceConflict",
				message: "OAUTH_ACCOUNT_ALREADY_LINKED",
				kind: "OAUTH_ACCOUNT_ALREADY_LINKED",
			});
		});
	});

	describe("updateOAuthTokens", () => {
		it("모든 OAuth 토큰을 갱신한다", async () => {
			// Given
			const updatedOAuthAccount = AccountBuilder.create("user-123")
				.withId(2)
				.asGoogle("google-user-id")
				.withOAuthTokens("new-access-token", "new-refresh-token", new Date("2025-03-01T00:00:00Z"))
				.build();
			db.account.update.mockResolvedValue(updatedOAuthAccount);
			const tokens = {
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
				accessTokenExpiresAt: new Date("2025-03-01T00:00:00Z"),
			};

			// When
			const result = await repository.updateOAuthTokens("user-123", "GOOGLE", tokens);

			// Then
			expect(result).toEqual(updatedOAuthAccount);
			expect(db.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
				data: {
					accessToken: "new-access-token",
					refreshToken: "new-refresh-token",
					accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				},
			});
		});

		it("액세스 토큰만 갱신한다", async () => {
			// Given
			const partialUpdatedAccount = AccountBuilder.create("user-123")
				.withId(2)
				.asGoogle("google-user-id")
				.withOAuthTokens("new-access-token")
				.build();
			db.account.update.mockResolvedValue(partialUpdatedAccount);
			const tokens = {
				accessToken: "new-access-token",
			};

			// When
			const result = await repository.updateOAuthTokens("user-123", "GOOGLE", tokens);

			// Then
			expect(result).toEqual(partialUpdatedAccount);
			expect(db.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
				data: {
					accessToken: "new-access-token",
				},
			});
		});

		it("활성 트랜잭션 클라이언트를 사용하여 갱신한다", async () => {
			// Given
			const updatedOAuthAccount = AccountBuilder.create("user-123")
				.withId(2)
				.asGoogle("google-user-id")
				.withOAuthTokens("new-access-token", "new-refresh-token")
				.build();
			db.account.update.mockResolvedValue(updatedOAuthAccount);
			const tokens = {
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
			};

			// When
			const result = await repository.updateOAuthTokens("user-123", "GOOGLE", tokens);

			// Then
			expect(result).toEqual(updatedOAuthAccount);
			expect(db.account.update).toHaveBeenCalled();
		});
	});

	describe("deleteAccount", () => {
		it("계정을 삭제한다", async () => {
			// Given
			db.account.delete.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.deleteAccount("user-123", "GOOGLE");

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(db.account.delete).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
			});
		});

		it("활성 트랜잭션 클라이언트를 사용하여 삭제한다", async () => {
			// Given
			db.account.delete.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.deleteAccount("user-123", "GOOGLE");

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(db.account.delete).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
			});
		});
	});

	describe("findAllByUserId", () => {
		it("사용자의 모든 계정을 조회한다", async () => {
			// Given
			const accounts = [mockCredentialAccount, mockOAuthAccount];
			db.account.findMany.mockResolvedValue(accounts);

			// When
			const result = await repository.findAllByUserId("user-123");

			// Then
			expect(result).toEqual(accounts);
			expect(db.account.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});

		it("계정이 없으면 빈 배열을 반환한다", async () => {
			// Given
			db.account.findMany.mockResolvedValue([]);

			// When
			const result = await repository.findAllByUserId("user-without-accounts");

			// Then
			expect(result).toEqual([]);
		});
	});
});

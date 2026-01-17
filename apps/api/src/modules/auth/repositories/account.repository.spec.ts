import { Test, type TestingModule } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { Account } from "@/generated/prisma/client";

import { AccountRepository } from "./account.repository";

describe("AccountRepository", () => {
	let repository: AccountRepository;
	let mockDatabase: {
		account: {
			findUnique: jest.Mock;
			findMany: jest.Mock;
			create: jest.Mock;
			update: jest.Mock;
			delete: jest.Mock;
		};
	};

	const mockCredentialAccount: Account = {
		id: 1,
		userId: "user-123",
		provider: "CREDENTIAL",
		providerAccountId: "user-123",
		password: "hashed-password",
		accessToken: null,
		refreshToken: null,
		accessTokenExpiresAt: null,
		scope: null,
		createdAt: new Date("2025-01-01T00:00:00Z"),
		updatedAt: new Date("2025-01-01T00:00:00Z"),
	};

	const mockOAuthAccount: Account = {
		id: 2,
		userId: "user-123",
		provider: "GOOGLE",
		providerAccountId: "google-user-id",
		password: null,
		accessToken: "google-access-token",
		refreshToken: "google-refresh-token",
		accessTokenExpiresAt: new Date("2025-02-01T00:00:00Z"),
		scope: "email profile",
		createdAt: new Date("2025-01-01T00:00:00Z"),
		updatedAt: new Date("2025-01-01T00:00:00Z"),
	};

	beforeEach(async () => {
		mockDatabase = {
			account: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				delete: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AccountRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<AccountRepository>(AccountRepository);
	});

	describe("findByUserIdAndProvider", () => {
		it("사용자 ID와 제공자로 계정을 찾는다", async () => {
			// Given
			mockDatabase.account.findUnique.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.findByUserIdAndProvider(
				"user-123",
				"CREDENTIAL",
			);

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(mockDatabase.account.findUnique).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
			});
		});

		it("존재하지 않으면 null을 반환한다", async () => {
			// Given
			mockDatabase.account.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByUserIdAndProvider(
				"user-123",
				"GOOGLE",
			);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByProviderAccountId", () => {
		it("제공자 계정 ID로 계정을 찾는다", async () => {
			// Given
			mockDatabase.account.findUnique.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.findByProviderAccountId(
				"GOOGLE",
				"google-user-id",
			);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(mockDatabase.account.findUnique).toHaveBeenCalledWith({
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
			mockDatabase.account.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByProviderAccountId(
				"GOOGLE",
				"non-existent-id",
			);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("createCredentialAccount", () => {
		it("Credential 계정을 생성한다", async () => {
			// Given
			mockDatabase.account.create.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.createCredentialAccount(
				"user-123",
				"hashed-password",
			);

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(mockDatabase.account.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					provider: "CREDENTIAL",
					providerAccountId: "user-123",
					password: "hashed-password",
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.account.create.mockResolvedValue(mockCredentialAccount);

			// When
			const result = await repository.createCredentialAccount(
				"user-123",
				"hashed-password",
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(mockCredentialAccount);
			expect(mockTx.account.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					provider: "CREDENTIAL",
					providerAccountId: "user-123",
					password: "hashed-password",
				},
			});
			expect(mockDatabase.account.create).not.toHaveBeenCalled();
		});
	});

	describe("updatePassword", () => {
		const updatedAccount: Account = {
			...mockCredentialAccount,
			password: "new-hashed-password",
			updatedAt: new Date("2025-01-15T00:00:00Z"),
		};

		it("비밀번호를 업데이트한다", async () => {
			// Given
			mockDatabase.account.update.mockResolvedValue(updatedAccount);

			// When
			const result = await repository.updatePassword(
				"user-123",
				"new-hashed-password",
			);

			// Then
			expect(result).toEqual(updatedAccount);
			expect(mockDatabase.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
				data: { password: "new-hashed-password" },
			});
		});

		it("트랜잭션 클라이언트를 사용하여 업데이트한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.account.update.mockResolvedValue(updatedAccount);

			// When
			const result = await repository.updatePassword(
				"user-123",
				"new-hashed-password",
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(updatedAccount);
			expect(mockTx.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "CREDENTIAL" },
				},
				data: { password: "new-hashed-password" },
			});
			expect(mockDatabase.account.update).not.toHaveBeenCalled();
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
			mockDatabase.account.create.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.createOAuthAccount(oAuthData);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(mockDatabase.account.create).toHaveBeenCalledWith({
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
			const minimalAccount: Account = {
				...mockOAuthAccount,
				provider: "APPLE",
				providerAccountId: "apple-user-id",
				accessToken: null,
				refreshToken: null,
				accessTokenExpiresAt: null,
				scope: null,
			};
			mockDatabase.account.create.mockResolvedValue(minimalAccount);

			// When
			const result = await repository.createOAuthAccount(minimalData);

			// Then
			expect(result).toEqual(minimalAccount);
			expect(mockDatabase.account.create).toHaveBeenCalledWith({
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

		it("트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.account.create.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.createOAuthAccount(
				oAuthData,
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(mockTx.account.create).toHaveBeenCalled();
			expect(mockDatabase.account.create).not.toHaveBeenCalled();
		});
	});

	describe("updateOAuthTokens", () => {
		const updatedOAuthAccount: Account = {
			...mockOAuthAccount,
			accessToken: "new-access-token",
			refreshToken: "new-refresh-token",
			accessTokenExpiresAt: new Date("2025-03-01T00:00:00Z"),
		};

		it("모든 OAuth 토큰을 갱신한다", async () => {
			// Given
			mockDatabase.account.update.mockResolvedValue(updatedOAuthAccount);
			const tokens = {
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
				accessTokenExpiresAt: new Date("2025-03-01T00:00:00Z"),
			};

			// When
			const result = await repository.updateOAuthTokens(
				"user-123",
				"GOOGLE",
				tokens,
			);

			// Then
			expect(result).toEqual(updatedOAuthAccount);
			expect(mockDatabase.account.update).toHaveBeenCalledWith({
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
			const partialUpdatedAccount: Account = {
				...mockOAuthAccount,
				accessToken: "new-access-token",
			};
			mockDatabase.account.update.mockResolvedValue(partialUpdatedAccount);
			const tokens = {
				accessToken: "new-access-token",
			};

			// When
			const result = await repository.updateOAuthTokens(
				"user-123",
				"GOOGLE",
				tokens,
			);

			// Then
			expect(result).toEqual(partialUpdatedAccount);
			expect(mockDatabase.account.update).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
				data: {
					accessToken: "new-access-token",
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 갱신한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.account.update.mockResolvedValue(updatedOAuthAccount);
			const tokens = {
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
			};

			// When
			const result = await repository.updateOAuthTokens(
				"user-123",
				"GOOGLE",
				tokens,
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(updatedOAuthAccount);
			expect(mockTx.account.update).toHaveBeenCalled();
			expect(mockDatabase.account.update).not.toHaveBeenCalled();
		});
	});

	describe("deleteAccount", () => {
		it("계정을 삭제한다", async () => {
			// Given
			mockDatabase.account.delete.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.deleteAccount("user-123", "GOOGLE");

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(mockDatabase.account.delete).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 삭제한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.account.delete.mockResolvedValue(mockOAuthAccount);

			// When
			const result = await repository.deleteAccount(
				"user-123",
				"GOOGLE",
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(mockOAuthAccount);
			expect(mockTx.account.delete).toHaveBeenCalledWith({
				where: {
					userId_provider: { userId: "user-123", provider: "GOOGLE" },
				},
			});
			expect(mockDatabase.account.delete).not.toHaveBeenCalled();
		});
	});

	describe("findAllByUserId", () => {
		it("사용자의 모든 계정을 조회한다", async () => {
			// Given
			const accounts = [mockCredentialAccount, mockOAuthAccount];
			mockDatabase.account.findMany.mockResolvedValue(accounts);

			// When
			const result = await repository.findAllByUserId("user-123");

			// Then
			expect(result).toEqual(accounts);
			expect(mockDatabase.account.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});

		it("계정이 없으면 빈 배열을 반환한다", async () => {
			// Given
			mockDatabase.account.findMany.mockResolvedValue([]);

			// When
			const result = await repository.findAllByUserId("user-without-accounts");

			// Then
			expect(result).toEqual([]);
		});
	});
});

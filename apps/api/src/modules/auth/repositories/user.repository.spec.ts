import { Test, type TestingModule } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { User, UserStatus } from "@/generated/prisma/client";
import * as userTagUtil from "../utils/user-tag.util";
import { UserRepository } from "./user.repository";

// 유틸리티 함수 모킹
jest.mock("../utils/user-tag.util");
const mockGenerateUserTag = userTagUtil.generateUserTag as jest.MockedFunction<
	typeof userTagUtil.generateUserTag
>;

// 테스트용 상수
const TEST_USER_TAG = "XY7Z9W3K";

describe("UserRepository", () => {
	let repository: UserRepository;
	let mockDatabase: {
		user: {
			findUnique: jest.Mock;
			findFirst: jest.Mock;
			count: jest.Mock;
			create: jest.Mock;
			update: jest.Mock;
		};
	};

	const mockUser: User = {
		id: "user-123",
		email: "test@example.com",
		userTag: "ABC12DEF",
		status: "ACTIVE" as UserStatus,
		emailVerifiedAt: new Date("2024-01-01"),
		twoFactorEnabled: false,
		twoFactorSecret: null,
		subscriptionStatus: "FREE",
		subscriptionExpiresAt: null,
		revenueCatUserId: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		lastLoginAt: null,
		deletedAt: null,
	};

	beforeEach(async () => {
		mockDatabase = {
			user: {
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				count: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<UserRepository>(UserRepository);

		// 기본 모킹 설정
		mockGenerateUserTag.mockReturnValue(TEST_USER_TAG);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("findByEmail", () => {
		it("이메일로 사용자를 찾아 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(mockUser);

			// When
			const result = await repository.findByEmail("test@example.com");

			// Then
			expect(result).toEqual(mockUser);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { email: "test@example.com" },
			});
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByEmail("notfound@example.com");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByEmailWithCredential", () => {
		it("이메일로 사용자와 Credential 계정을 조회한다", async () => {
			// Given
			const userWithAccount = {
				id: mockUser.id,
				email: mockUser.email,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt,
				accounts: [
					{
						id: 1,
						provider: "CREDENTIAL",
						password: "hashed-password",
					},
				],
			};
			mockDatabase.user.findUnique.mockResolvedValue(userWithAccount);

			// When
			const result =
				await repository.findByEmailWithCredential("test@example.com");

			// Then
			expect(result).toEqual(userWithAccount);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { email: "test@example.com" },
				select: {
					id: true,
					email: true,
					status: true,
					emailVerifiedAt: true,
					accounts: {
						where: { provider: "CREDENTIAL" },
						select: {
							id: true,
							provider: true,
							password: true,
						},
					},
				},
			});
		});
	});

	describe("findById", () => {
		it("ID로 사용자를 찾아 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(mockUser);

			// When
			const result = await repository.findById("user-123");

			// Then
			expect(result).toEqual(mockUser);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-123" },
			});
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findById("nonexistent-id");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByIdWithProfile", () => {
		it("ID로 사용자와 프로필을 조회한다", async () => {
			// Given
			const userWithProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
				createdAt: mockUser.createdAt,
				lastLoginAt: mockUser.lastLoginAt,
				profile: {
					name: "Test User",
					profileImage: null,
				},
			};
			mockDatabase.user.findUnique.mockResolvedValue(userWithProfile);

			// When
			const result = await repository.findByIdWithProfile("user-123");

			// Then
			expect(result).toEqual(userWithProfile);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-123" },
				select: {
					id: true,
					email: true,
					userTag: true,
					status: true,
					emailVerifiedAt: true,
					subscriptionStatus: true,
					subscriptionExpiresAt: true,
					createdAt: true,
					lastLoginAt: true,
					profile: {
						select: {
							name: true,
							profileImage: true,
						},
					},
				},
			});
		});

		it("프로필이 없는 사용자도 조회한다", async () => {
			// Given
			const userWithoutProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
				createdAt: mockUser.createdAt,
				lastLoginAt: mockUser.lastLoginAt,
				profile: null,
			};
			mockDatabase.user.findUnique.mockResolvedValue(userWithoutProfile);

			// When
			const result = await repository.findByIdWithProfile("user-123");

			// Then
			expect(result?.profile).toBeNull();
		});
	});

	describe("existsByEmail", () => {
		it("이메일이 존재하면 true를 반환한다", async () => {
			// Given
			mockDatabase.user.count.mockResolvedValue(1);

			// When
			const result = await repository.existsByEmail("test@example.com");

			// Then
			expect(result).toBe(true);
			expect(mockDatabase.user.count).toHaveBeenCalledWith({
				where: { email: "test@example.com" },
			});
		});

		it("이메일이 존재하지 않으면 false를 반환한다", async () => {
			// Given
			mockDatabase.user.count.mockResolvedValue(0);

			// When
			const result = await repository.existsByEmail("notfound@example.com");

			// Then
			expect(result).toBe(false);
		});
	});

	describe("create", () => {
		it("새 사용자를 생성한다", async () => {
			// Given
			const createData = {
				email: "new@example.com",
				status: "PENDING_VERIFICATION" as UserStatus,
			};
			// userTag 중복 체크용 - null 반환으로 고유한 태그임을 나타냄
			mockDatabase.user.findUnique.mockResolvedValue(null);
			mockDatabase.user.create.mockResolvedValue({
				...mockUser,
				...createData,
				id: "new-user-123",
				userTag: TEST_USER_TAG,
			});

			// When
			const result = await repository.create(createData);

			// Then
			expect(result.email).toBe("new@example.com");
			expect(result.userTag).toBe(TEST_USER_TAG);
			expect(mockGenerateUserTag).toHaveBeenCalled();
			expect(mockDatabase.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: createData.email,
					status: createData.status,
					userTag: TEST_USER_TAG,
				}),
			});
		});

		it("트랜잭션 내에서 사용자를 생성한다", async () => {
			// Given
			const createData = {
				email: "new@example.com",
				status: "PENDING_VERIFICATION" as UserStatus,
			};
			const mockTx = createMockTxClient();
			// userTag 중복 체크용
			mockTx.user.findUnique.mockResolvedValue(null);
			mockTx.user.create.mockResolvedValue({
				...mockUser,
				...createData,
				id: "tx-user-123",
				userTag: TEST_USER_TAG,
			});

			// When
			const result = await repository.create(createData, asTxClient(mockTx));

			// Then
			expect(result.id).toBe("tx-user-123");
			expect(result.userTag).toBe(TEST_USER_TAG);
			expect(mockGenerateUserTag).toHaveBeenCalled();
			expect(mockTx.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: createData.email,
					status: createData.status,
					userTag: TEST_USER_TAG,
				}),
			});
		});
	});

	describe("updateStatus", () => {
		it("사용자 상태를 업데이트한다", async () => {
			// Given
			const updatedUser = { ...mockUser, status: "SUSPENDED" as UserStatus };
			mockDatabase.user.update.mockResolvedValue(updatedUser);

			// When
			const result = await repository.updateStatus("user-123", "SUSPENDED");

			// Then
			expect(result.status).toBe("SUSPENDED");
			expect(mockDatabase.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { status: "SUSPENDED" },
			});
		});

		it("트랜잭션 내에서 상태를 업데이트한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue({
				...mockUser,
				status: "ACTIVE" as UserStatus,
			});

			// When
			await repository.updateStatus("user-123", "ACTIVE", asTxClient(mockTx));

			// Then
			expect(mockTx.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { status: "ACTIVE" },
			});
		});
	});

	describe("markEmailVerified", () => {
		it("이메일 인증을 완료 처리한다", async () => {
			// Given
			const verifiedUser = {
				...mockUser,
				emailVerifiedAt: new Date(),
				status: "ACTIVE" as UserStatus,
			};
			mockDatabase.user.update.mockResolvedValue(verifiedUser);

			// When
			const result = await repository.markEmailVerified("user-123");

			// Then
			expect(result.status).toBe("ACTIVE");
			expect(result.emailVerifiedAt).toBeDefined();
			expect(mockDatabase.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: {
					emailVerifiedAt: expect.any(Date),
					status: "ACTIVE",
				},
			});
		});

		it("트랜잭션 내에서 인증 완료 처리한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue({
				...mockUser,
				emailVerifiedAt: new Date(),
				status: "ACTIVE" as UserStatus,
			});

			// When
			await repository.markEmailVerified("user-123", asTxClient(mockTx));

			// Then
			expect(mockTx.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: {
					emailVerifiedAt: expect.any(Date),
					status: "ACTIVE",
				},
			});
		});
	});

	describe("updateLastLoginAt", () => {
		it("마지막 로그인 시간을 업데이트한다", async () => {
			// Given
			mockDatabase.user.update.mockResolvedValue({
				...mockUser,
				lastLoginAt: new Date(),
			});

			// When
			await repository.updateLastLoginAt("user-123");

			// Then
			expect(mockDatabase.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { lastLoginAt: expect.any(Date) },
			});
		});

		it("트랜잭션 내에서 로그인 시간을 업데이트한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue({
				...mockUser,
				lastLoginAt: new Date(),
			});

			// When
			await repository.updateLastLoginAt("user-123", asTxClient(mockTx));

			// Then
			expect(mockTx.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { lastLoginAt: expect.any(Date) },
			});
		});
	});
});

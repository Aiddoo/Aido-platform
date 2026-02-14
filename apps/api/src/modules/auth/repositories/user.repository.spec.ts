import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UserBuilder } from "@test/builders";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type {
	AccountProvider,
	SubscriptionStatus,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";
import * as userTagUtil from "../utils/user-tag.util";
import { UserRepository } from "./user.repository";

// =============================================================================
// Type Definitions for Test
// =============================================================================

/**
 * findByEmailWithCredential의 select 결과 타입
 */
interface UserWithCredential {
	id: string;
	email: string;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	accounts: Array<{
		id: number;
		provider: string;
		password: string | null;
	}>;
}

/**
 * findByIdWithProfile의 select 결과 타입
 */
interface UserWithProfile {
	id: string;
	email: string;
	userTag: string;
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: Date | null;
	createdAt: Date;
	lastLoginAt: Date | null;
	profile: {
		name: string;
		profileImage: string | null;
	} | null;
	accounts: {
		provider: AccountProvider;
	}[];
}

// 유틸리티 함수 모킹
jest.mock("../utils/user-tag.util");
const mockGenerateUserTag = userTagUtil.generateUserTag as jest.MockedFunction<
	typeof userTagUtil.generateUserTag
>;

// 테스트용 상수
const TEST_USER_TAG = "XY7Z9W3K";

describe("UserRepository", () => {
	let repository: UserRepository;
	let db: Mocked<DatabaseService>;

	// Builder로 기본 테스트 사용자 생성
	const mockUser = UserBuilder.create()
		.withId("user-123")
		.withEmail("test@example.com")
		.withUserTag("ABC12DEF")
		.verified()
		.build();

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(UserRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService) as unknown as Mocked<DatabaseService>;

		// 기본 모킹 설정
		mockGenerateUserTag.mockReturnValue(TEST_USER_TAG);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("findByEmail", () => {
		it("이메일로 사용자를 찾아 반환한다", async () => {
			// Given - 사용자가 존재하는 경우를 모킹
			db.user.findUnique.mockResolvedValue(mockUser);

			// When - 이메일로 사용자 조회
			const result = await repository.findByEmail("test@example.com");

			// Then - 사용자 정보를 반환하고 올바른 쿼리가 실행됨
			expect(result).toEqual(mockUser);
			expect(db.user.findUnique).toHaveBeenCalledWith({
				where: { email: "test@example.com" },
			});
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given - 사용자가 존재하지 않는 경우를 모킹
			db.user.findUnique.mockResolvedValue(null);

			// When - 존재하지 않는 이메일로 조회
			const result = await repository.findByEmail("notfound@example.com");

			// Then - null 반환
			expect(result).toBeNull();
		});
	});

	describe("findByEmailWithCredential", () => {
		it("이메일로 사용자와 Credential 계정을 조회한다", async () => {
			// Given - Credential 계정을 가진 사용자 데이터 준비
			const userWithAccount: UserWithCredential = {
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
			db.user.findUnique.mockResolvedValue(userWithAccount as never);

			// When - 이메일로 사용자와 Credential 계정 조회
			const result =
				await repository.findByEmailWithCredential("test@example.com");

			// Then - 사용자와 계정 정보가 함께 반환되고 올바른 select 쿼리가 실행됨
			expect(result).toEqual(userWithAccount);
			expect(db.user.findUnique).toHaveBeenCalledWith({
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
			// Given - 사용자가 존재하는 경우를 모킹
			db.user.findUnique.mockResolvedValue(mockUser);

			// When - ID로 사용자 조회
			const result = await repository.findById("user-123");

			// Then - 사용자 정보를 반환하고 올바른 쿼리가 실행됨
			expect(result).toEqual(mockUser);
			expect(db.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-123" },
			});
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given - 사용자가 존재하지 않는 경우를 모킹
			db.user.findUnique.mockResolvedValue(null);

			// When - 존재하지 않는 ID로 조회
			const result = await repository.findById("nonexistent-id");

			// Then - null 반환
			expect(result).toBeNull();
		});
	});

	describe("findByIdWithProfile", () => {
		it("ID로 사용자와 프로필을 조회한다", async () => {
			// Given - 프로필이 있는 사용자 데이터 준비
			const userWithProfile: UserWithProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				role: mockUser.role,
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
				accounts: [{ provider: "CREDENTIAL" as AccountProvider }],
			};
			db.user.findUnique.mockResolvedValue(userWithProfile as never);

			// When - ID로 사용자와 프로필 조회
			const result = await repository.findByIdWithProfile("user-123");

			// Then - 사용자와 프로필 정보가 함께 반환되고 올바른 select 쿼리가 실행됨
			expect(result).toEqual(userWithProfile);
			expect(db.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-123" },
				select: {
					id: true,
					email: true,
					userTag: true,
					role: true,
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
					accounts: {
						select: {
							provider: true,
						},
					},
				},
			});
		});

		it("프로필이 없는 사용자도 조회한다", async () => {
			// Given - 프로필이 없는 사용자 데이터 준비
			const userWithoutProfile: UserWithProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				role: mockUser.role,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
				createdAt: mockUser.createdAt,
				lastLoginAt: mockUser.lastLoginAt,
				profile: null,
				accounts: [{ provider: "CREDENTIAL" as AccountProvider }],
			};
			db.user.findUnique.mockResolvedValue(userWithoutProfile as never);

			// When - ID로 프로필이 없는 사용자 조회
			const result = await repository.findByIdWithProfile("user-123");

			// Then - 프로필이 null인 상태로 반환
			expect(result?.profile).toBeNull();
		});
	});

	describe("existsByEmail", () => {
		it("이메일이 존재하면 true를 반환한다", async () => {
			// Given - 해당 이메일의 사용자가 1명 존재하는 경우를 모킹
			db.user.count.mockResolvedValue(1);

			// When - 이메일 존재 여부 확인
			const result = await repository.existsByEmail("test@example.com");

			// Then - true 반환하고 올바른 count 쿼리가 실행됨
			expect(result).toBe(true);
			expect(db.user.count).toHaveBeenCalledWith({
				where: { email: "test@example.com" },
			});
		});

		it("이메일이 존재하지 않으면 false를 반환한다", async () => {
			// Given - 해당 이메일의 사용자가 없는 경우를 모킹
			db.user.count.mockResolvedValue(0);

			// When - 존재하지 않는 이메일로 확인
			const result = await repository.existsByEmail("notfound@example.com");

			// Then - false 반환
			expect(result).toBe(false);
		});
	});

	describe("create", () => {
		it("새 사용자를 생성한다", async () => {
			// Given - 사용자 생성 데이터 준비 및 userTag 중복 없음 모킹
			const createData = {
				email: "new@example.com",
				status: "PENDING_VERIFICATION" as UserStatus,
			};
			const newUser = UserBuilder.create()
				.withId("new-user-123")
				.withEmail(createData.email)
				.withUserTag(TEST_USER_TAG)
				.withStatus(createData.status)
				.build();

			db.user.findUnique.mockResolvedValue(null);
			db.user.create.mockResolvedValue(newUser);

			// When - 새 사용자 생성
			const result = await repository.create(createData);

			// Then - 생성된 사용자 반환하고 userTag가 자동 생성됨
			expect(result.email).toBe("new@example.com");
			expect(result.userTag).toBe(TEST_USER_TAG);
			expect(mockGenerateUserTag).toHaveBeenCalled();
			expect(db.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: createData.email,
					status: createData.status,
					userTag: TEST_USER_TAG,
				}),
			});
		});

		it("트랜잭션 내에서 사용자를 생성한다", async () => {
			// Given - 트랜잭션 클라이언트와 사용자 생성 데이터 준비
			const createData = {
				email: "new@example.com",
				status: "PENDING_VERIFICATION" as UserStatus,
			};
			const txUser = UserBuilder.create()
				.withId("tx-user-123")
				.withEmail(createData.email)
				.withUserTag(TEST_USER_TAG)
				.withStatus(createData.status)
				.build();

			const mockTx = createMockTxClient();
			mockTx.user.findUnique.mockResolvedValue(null);
			mockTx.user.create.mockResolvedValue(txUser);

			// When - 트랜잭션 내에서 사용자 생성
			const result = await repository.create(createData, asTxClient(mockTx));

			// Then - 트랜잭션 클라이언트를 통해 생성되고 userTag가 자동 생성됨
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
			// Given - 상태가 업데이트된 사용자 데이터 모킹
			const updatedUser = UserBuilder.create()
				.withId("user-123")
				.suspended()
				.build();
			db.user.update.mockResolvedValue(updatedUser);

			// When - 사용자 상태를 SUSPENDED로 업데이트
			const result = await repository.updateStatus("user-123", "SUSPENDED");

			// Then - 업데이트된 사용자 반환하고 올바른 update 쿼리가 실행됨
			expect(result.status).toBe("SUSPENDED");
			expect(db.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { status: "SUSPENDED" },
			});
		});

		it("트랜잭션 내에서 상태를 업데이트한다", async () => {
			// Given - 트랜잭션 클라이언트와 업데이트 결과 모킹
			const activeUser = UserBuilder.create()
				.withId("user-123")
				.verified()
				.build();
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue(activeUser);

			// When - 트랜잭션 내에서 상태 업데이트
			await repository.updateStatus("user-123", "ACTIVE", asTxClient(mockTx));

			// Then - 트랜잭션 클라이언트를 통해 업데이트됨
			expect(mockTx.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { status: "ACTIVE" },
			});
		});
	});

	describe("markEmailVerified", () => {
		it("이메일 인증을 완료 처리한다", async () => {
			// Given - 이메일 인증 완료된 사용자 데이터 모킹
			const verifiedUser = UserBuilder.create()
				.withId("user-123")
				.verified()
				.build();
			db.user.update.mockResolvedValue(verifiedUser);

			// When - 이메일 인증 완료 처리
			const result = await repository.markEmailVerified("user-123");

			// Then - 인증 완료된 사용자 반환하고 상태가 ACTIVE로 변경됨
			expect(result.status).toBe("ACTIVE");
			expect(result.emailVerifiedAt).toBeDefined();
			expect(db.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: {
					emailVerifiedAt: expect.any(Date),
					status: "ACTIVE",
				},
			});
		});

		it("트랜잭션 내에서 인증 완료 처리한다", async () => {
			// Given - 트랜잭션 클라이언트와 인증 완료 결과 모킹
			const verifiedUser = UserBuilder.create()
				.withId("user-123")
				.verified()
				.build();
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue(verifiedUser);

			// When - 트랜잭션 내에서 이메일 인증 완료 처리
			await repository.markEmailVerified("user-123", asTxClient(mockTx));

			// Then - 트랜잭션 클라이언트를 통해 인증 완료 처리됨
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
			// Given - 로그인 시간이 업데이트된 사용자 데이터 모킹
			const userWithLogin = UserBuilder.create()
				.withId("user-123")
				.withLastLoginAt(new Date())
				.build();
			db.user.update.mockResolvedValue(userWithLogin);

			// When - 마지막 로그인 시간 업데이트
			await repository.updateLastLoginAt("user-123");

			// Then - 올바른 update 쿼리가 실행됨
			expect(db.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { lastLoginAt: expect.any(Date) },
			});
		});

		it("트랜잭션 내에서 로그인 시간을 업데이트한다", async () => {
			// Given - 트랜잭션 클라이언트와 업데이트 결과 모킹
			const userWithLogin = UserBuilder.create()
				.withId("user-123")
				.withLastLoginAt(new Date())
				.build();
			const mockTx = createMockTxClient();
			mockTx.user.update.mockResolvedValue(userWithLogin);

			// When - 트랜잭션 내에서 로그인 시간 업데이트
			await repository.updateLastLoginAt("user-123", asTxClient(mockTx));

			// Then - 트랜잭션 클라이언트를 통해 업데이트됨
			expect(mockTx.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { lastLoginAt: expect.any(Date) },
			});
		});
	});
});

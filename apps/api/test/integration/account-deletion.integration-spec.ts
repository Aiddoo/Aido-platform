/**
 * 회원 탈퇴 통합 테스트 (Testcontainers)
 *
 * @description
 * AuthService.deleteAccount()와 AccountPurgeJob이
 * 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 *
 * 통합 테스트의 목적:
 * - AuthService → Repository → Prisma → PostgreSQL 전체 스택 검증
 * - 회원 탈퇴 soft delete + 세션 폐기 + 보안 로그 기록
 * - AccountPurgeJob hard delete 플로우
 * - 탈퇴 후 로그인/비밀번호 재설정 차단
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test account-deletion.integration-spec
 * ```
 */

import { ACCOUNT_DELETION } from "@aido/validators";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { suppressLogger } from "@test/setup/suppress-logger";
import { AdminNotificationFacade } from "@/admin-notification";
import { AuthService } from "@/auth/application/services/auth.service";
import { PasswordManagementService } from "@/auth/application/services/password-management.service";
import { SessionService } from "@/auth/application/services/session.service";
import { VerificationService } from "@/auth/application/services/verification.service";
import { IssueLoginUseCase } from "@/auth/application/use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "@/auth/application/use-cases/provision-user/provision-user.use-case";
import { PasswordService } from "@/auth/infrastructure/adapters/password.service";
import { TokenService } from "@/auth/infrastructure/adapters/token.service";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { LoginAttemptRepository } from "@/auth/infrastructure/persistence/login-attempt.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { SessionRepository } from "@/auth/infrastructure/persistence/session.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { VerificationRepository } from "@/auth/infrastructure/persistence/verification.repository";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "@/auth/infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";
import { EmailFacade } from "@/email";
import { NotificationQueueService } from "@/notification";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CACHE_SERVICE } from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { EncryptionService } from "@/shared/infrastructure/encryption";
import { TodoCategoryRepository } from "@/todo-category/todo-category.repository";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";

describe("회원 탈퇴 통합 테스트 (실제 DB)", () => {
	let module: TestingModule;
	let authService: AuthService;
	let passwordManagementService: PasswordManagementService;
	let purgeJob: AccountPurgeJob;
	let testDb: TestDatabase;
	let databaseService: DatabaseService;
	let _userRepository: UserRepository;
	let _accountRepository: AccountRepository;
	let _sessionRepository: SessionRepository;
	let _securityLogRepository: SecurityLogRepository;

	beforeAll(async () => {
		suppressLogger();

		testDb = new TestDatabase();
		databaseService = (await testDb.start()) as DatabaseService;

		module = await Test.createTestingModule({
			imports: [
				JwtModule.register({
					secret: process.env.JWT_SECRET,
					signOptions: { expiresIn: "15m" },
				}),
			],
			providers: [
				AuthService,
				IssueLoginUseCase,
				ProvisionUserUseCase,
				AccountPurgeJob,
				{
					provide: getQueueToken(ACCOUNT_PURGE_QUEUE),
					useValue: {
						add: jest.fn(),
						upsertJobScheduler: jest.fn(),
					},
				},
				{
					provide: AccountPurgeProcessor,
					useValue: {
						setPurgeJob: jest.fn(),
					},
				},
				PasswordService,
				PasswordManagementService,
				SessionService,
				TokenService,
				VerificationService,
				{
					provide: EncryptionService,
					useValue: {
						encrypt: (value: string) => value,
						decryptSafe: (value: string) => value,
					},
				},
				AccountRepository,
				UserRepository,
				SessionRepository,
				SecurityLogRepository,
				LoginAttemptRepository,
				VerificationRepository,
				UserConsentRepository,
				UserPreferenceRepository,
				TodoCategoryRepository,
				{
					provide: DatabaseService,
					useValue: databaseService,
				},
				{
					// CLS 트랜잭션 스텁 — 활성 트랜잭션이 없을 때 tx가 실제 DB 클라이언트를 반환
					provide: TransactionHost,
					useValue: { tx: databaseService },
				},
				{
					provide: EmailFacade,
					useClass: FakeEmailService,
				},
				{
					provide: CacheService,
					useValue: {
						invalidateSession: async () => {},
						invalidateUserProfile: async () => {},
						wrapUserProfile: async (
							_userId: string,
							fn: () => Promise<unknown>,
						) => fn(),
					},
				},
				{
					provide: CACHE_SERVICE,
					useValue: {
						get: async () => undefined,
						set: async () => {},
						del: async () => {},
					},
				},
				{
					provide: TypedConfigService,
					useValue: {
						get: (key: string) => {
							const config: Record<string, string> = {
								JWT_SECRET:
									process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
								JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
								JWT_REFRESH_SECRET:
									process.env.JWT_REFRESH_SECRET ??
									"test-jwt-refresh-secret-for-integration",
								JWT_REFRESH_EXPIRES_IN:
									process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
							};
							return config[key];
						},
						jwtSecret:
							process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
						jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
						jwtRefreshSecret:
							process.env.JWT_REFRESH_SECRET ??
							"test-jwt-refresh-secret-for-integration",
						jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
						jwtConfig: {
							secret:
								process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
							expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
							refreshSecret:
								process.env.JWT_REFRESH_SECRET ??
								"test-jwt-refresh-secret-for-integration",
							refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
						},
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: (key: string) => {
							const config: Record<string, string> = {
								JWT_SECRET:
									process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
								JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
								JWT_REFRESH_SECRET:
									process.env.JWT_REFRESH_SECRET ??
									"test-jwt-refresh-secret-for-integration",
								JWT_REFRESH_EXPIRES_IN:
									process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
							};
							return config[key];
						},
					},
				},
				{
					provide: AdminNotificationFacade,
					useValue: {
						notifyUserRegistered: () => {},
						notifySubscriptionEvent: () => {},
					},
				},
				{
					provide: NotificationQueueService,
					useValue: {
						enqueueFollowNew: () => {},
						enqueueFollowMutual: () => {},
						enqueueNudgeSent: () => {},
						enqueueCheerSent: () => {},
						enqueueBillingIssue: () => {},
					},
				},
			],
		}).compile();

		authService = module.get<AuthService>(AuthService);
		passwordManagementService = module.get<PasswordManagementService>(
			PasswordManagementService,
		);
		purgeJob = module.get<AccountPurgeJob>(AccountPurgeJob);
		_userRepository = module.get<UserRepository>(UserRepository);
		_accountRepository = module.get<AccountRepository>(AccountRepository);
		_sessionRepository = module.get<SessionRepository>(SessionRepository);
		_securityLogRepository = module.get<SecurityLogRepository>(
			SecurityLogRepository,
		);
	}, 60000);

	beforeEach(async () => {
		jest.clearAllMocks();
		await testDb.cleanup();
	});

	afterAll(async () => {
		if (testDb) await testDb.stop();
		if (module) await module.close();
	});

	/**
	 * 테스트용 이메일 계정 생성 + 인증 완료 헬퍼
	 * @returns userId
	 */
	async function createVerifiedCredentialUser(
		email: string,
		password: string,
	): Promise<string> {
		// 1. 회원가입
		const registerResult = await authService.register({
			email,
			password,
			passwordConfirm: password,
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
		});

		// 2. DB에서 직접 인증 완료 처리
		const prisma = testDb.getPrisma();
		await prisma.user.update({
			where: { id: registerResult.userId },
			data: {
				status: "ACTIVE",
				emailVerifiedAt: new Date(),
			},
		});

		return registerResult.userId;
	}

	describe("deleteAccount", () => {
		it("CREDENTIAL 계정: soft delete + 세션 폐기 + 보안 로그 기록", async () => {
			// Given
			const email = "delete-test@example.com";
			const password = "Test1234!";
			const userId = await createVerifiedCredentialUser(email, password);

			// 로그인하여 세션 생성
			await authService.login({ email, password });

			// When
			const result = await authService.deleteAccount(userId, "test-session", {
				password,
			});

			// Then
			expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
			expect(result.deletedAt).toBeDefined();

			// DB 검증: user.deletedAt 설정됨
			const prisma = testDb.getPrisma();
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.deletedAt).not.toBeNull();
			expect(user?.status).toBe("SUSPENDED");

			// DB 검증: 세션이 폐기됨
			const sessions = await prisma.session.findMany({
				where: { userId },
			});
			for (const session of sessions) {
				expect(session.revokedAt).not.toBeNull();
			}

			// DB 검증: 보안 로그 기록됨
			const logs = await prisma.securityLog.findMany({
				where: { userId, event: "ACCOUNT_DELETION_REQUESTED" },
			});
			expect(logs.length).toBeGreaterThanOrEqual(1);
		});

		it("소셜 전용 계정: 비밀번호 없이 탈퇴 처리", async () => {
			// Given - DB에 직접 소셜 사용자 생성
			const prisma = testDb.getPrisma();
			const user = await prisma.user.create({
				data: {
					email: "social-delete@example.com",
					userTag: "SODEL001",
					status: "ACTIVE",
					emailVerifiedAt: new Date(),
				},
			});
			await prisma.account.create({
				data: {
					userId: user.id,
					provider: "GOOGLE",
					providerAccountId: "google-123",
				},
			});

			// When
			const result = await authService.deleteAccount(
				user.id,
				"test-session",
				{},
			);

			// Then
			expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
			const deletedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});
			expect(deletedUser?.deletedAt).not.toBeNull();
		});

		it("유예 기간 내 credential 로그인 시 자동 복구", async () => {
			// Given - 탈퇴된 사용자
			const email = "login-after-delete@example.com";
			const password = "Test1234!";
			const userId = await createVerifiedCredentialUser(email, password);
			await authService.deleteAccount(userId, "test-session", { password });

			// When - 로그인 (탈퇴 직후 = 유예 기간 내)
			const loginResult = await authService.login({ email, password });

			// Then - 성공
			expect(loginResult.userId).toBe(userId);
			expect(loginResult.tokens.accessToken).toBeDefined();
			expect(loginResult.accountRestored).toBe(true);

			// DB 검증: 복구됨
			const prisma = testDb.getPrisma();
			const restoredUser = await prisma.user.findUnique({
				where: { id: userId },
			});
			expect(restoredUser?.deletedAt).toBeNull();
			expect(restoredUser?.status).toBe("ACTIVE");

			// 보안 로그: ACCOUNT_RESTORED 기록됨
			const logs = await prisma.securityLog.findMany({
				where: { userId, event: "ACCOUNT_RESTORED" },
			});
			expect(logs.length).toBeGreaterThanOrEqual(1);
		});

		it("유예 기간 초과 시 로그인 차단 (USER_0606)", async () => {
			// Given - 31일 전 탈퇴된 사용자 (DB 직접 생성)
			const prisma = testDb.getPrisma();
			const pastDate = new Date();
			pastDate.setDate(
				pastDate.getDate() - (ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1),
			);

			const email = "expired-delete@example.com";
			const password = "Test1234!";
			const userId = await createVerifiedCredentialUser(email, password);

			// DB에서 직접 탈퇴 처리 (유예 기간 초과)
			await prisma.user.update({
				where: { id: userId },
				data: { deletedAt: pastDate, status: "SUSPENDED" },
			});

			// When & Then
			await expect(authService.login({ email, password })).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("AccountPurgeJob — 계정 삭제 잡", () => {
		it("유예 기간 경과 후 hard delete 실행", async () => {
			// Given - deletedAt이 31일 전인 사용자 DB에 직접 생성
			const prisma = testDb.getPrisma();
			const pastDate = new Date();
			pastDate.setDate(
				pastDate.getDate() - (ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1),
			);

			const user = await prisma.user.create({
				data: {
					email: "purge-test@example.com",
					userTag: "PURGE001",
					status: "SUSPENDED",
					deletedAt: pastDate,
				},
			});

			// When
			await purgeJob.purgeDeletedAccounts();

			// Then - user가 DB에서 완전 삭제됨
			const deletedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});
			expect(deletedUser).toBeNull();
		});

		it("유예 기간 내 사용자는 삭제하지 않음", async () => {
			// Given - deletedAt이 29일 전인 사용자
			const prisma = testDb.getPrisma();
			const recentDate = new Date();
			recentDate.setDate(
				recentDate.getDate() - (ACCOUNT_DELETION.GRACE_PERIOD_DAYS - 1),
			);

			const user = await prisma.user.create({
				data: {
					email: "keep-test@example.com",
					userTag: "KEEP0001",
					status: "SUSPENDED",
					deletedAt: recentDate,
				},
			});

			// When
			await purgeJob.purgeDeletedAccounts();

			// Then - user가 여전히 DB에 존재
			const existingUser = await prisma.user.findUnique({
				where: { id: user.id },
			});
			expect(existingUser).not.toBeNull();
		});
	});

	describe("forgotPassword — 탈퇴 계정", () => {
		it("탈퇴 계정에 비밀번호 재설정 코드를 발송하지 않는다", async () => {
			// Given - soft deleted 사용자
			const email = "forgot-after-delete@example.com";
			const password = "Test1234!";
			const userId = await createVerifiedCredentialUser(email, password);
			await authService.deleteAccount(userId, "test-session", { password });

			// When
			const result = await passwordManagementService.forgotPassword(email);

			// Then - 동일 응답 반환 (보안상)
			expect(result.message).toBeDefined();

			// verification 레코드 미생성 확인
			const prisma = testDb.getPrisma();
			const verifications = await prisma.verification.findMany({
				where: { userId, type: "PASSWORD_RESET" },
			});
			expect(verifications.length).toBe(0);
		});
	});
});

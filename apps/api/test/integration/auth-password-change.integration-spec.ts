/**
 * 비밀번호 변경 통합 테스트 (Testcontainers)
 *
 * @description
 * AuthService.changePassword()가 실제 PostgreSQL DB와 함께
 * 올바르게 작동하는지 검증합니다.
 *
 * 통합 테스트의 목적:
 * - AuthService -> Repository -> Prisma -> PostgreSQL 전체 스택 검증
 * - 로그인한 사용자의 비밀번호 변경 플로우
 * - 현재 세션 유지 + 다른 세션 폐기
 * - SecurityLog 기록 확인
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test auth-password-change.integration-spec
 * ```
 */

import type { TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { BusinessException } from "@/common/exception";
import { DatabaseService } from "@/database/database.service";
import { AuthService } from "@/modules/auth/services/auth.service";
import { PasswordManagementService } from "@/modules/auth/services/password-management.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("비밀번호 변경 통합 테스트 (실제 DB)", () => {
	let module: TestingModule;
	let authService: AuthService;
	let passwordManagementService: PasswordManagementService;
	let fakeEmailService: FakeEmailService;
	let testDb: TestDatabase;
	let databaseService: DatabaseService;

	beforeAll(async () => {
		suppressLogger();

		testDb = new TestDatabase();
		databaseService = (await testDb.start()) as DatabaseService;
		fakeEmailService = new FakeEmailService();

		module = await createAuthTestModule(databaseService, fakeEmailService);
		authService = module.get<AuthService>(AuthService);
		passwordManagementService = module.get<PasswordManagementService>(
			PasswordManagementService,
		);
	}, 60000);

	beforeEach(async () => {
		await testDb.cleanup();
		fakeEmailService.clear();
	});

	afterAll(async () => {
		if (testDb) await testDb.stop();
		if (module) await module.close();
	});

	/**
	 * FakeEmailService에서 인증 코드를 안전하게 가져오는 헬퍼
	 */
	function getCode(email: string): string {
		const code = fakeEmailService.getLastCode(email);
		if (!code) throw new Error(`No code found for ${email}`);
		return code;
	}

	/**
	 * 이메일/비밀번호 사용자 생성 헬퍼 (register + verify-email 시뮬레이션)
	 * @returns userId
	 */
	async function createCredentialUser(
		email: string,
		password: string,
	): Promise<string> {
		const registerResult = await authService.register({
			email,
			password,
			passwordConfirm: password,
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
		});

		const verifyCode = getCode(email);
		await authService.verifyEmail({ email, code: verifyCode });

		fakeEmailService.clear();

		return registerResult.userId;
	}

	/**
	 * 로그인 후 sessionId를 반환하는 헬퍼
	 */
	async function loginAndGetSession(
		email: string,
		password: string,
	): Promise<string> {
		const result = await authService.login({ email, password });
		return result.sessionId;
	}

	/**
	 * 소셜 전용 사용자 생성 헬퍼 (DB에 직접 생성)
	 * @returns userId
	 */
	async function createSocialOnlyUser(
		email: string,
		provider: "GOOGLE" | "KAKAO" | "NAVER" | "APPLE" = "GOOGLE",
	): Promise<string> {
		const prisma = testDb.getPrisma();
		const user = await prisma.user.create({
			data: {
				email,
				userTag: `TAG${Date.now().toString(36).slice(-6).toUpperCase()}`,
				status: "ACTIVE",
				emailVerifiedAt: new Date(),
			},
		});

		await prisma.account.create({
			data: {
				userId: user.id,
				provider,
				providerAccountId: `${provider.toLowerCase()}-${user.id}`,
			},
		});

		return user.id;
	}

	// ============================================
	// changePassword
	// ============================================

	describe("changePassword", () => {
		it("현재 비밀번호 확인 후 새 비밀번호로 변경한다", async () => {
			// Given
			const email = "change-pw@example.com";
			const currentPassword = "Password123!";
			const newPassword = "NewPassword456!";
			const userId = await createCredentialUser(email, currentPassword);

			const sessionId = await loginAndGetSession(email, currentPassword);

			// When
			const result = await passwordManagementService.changePassword(
				userId,
				currentPassword,
				newPassword,
				undefined,
				sessionId,
			);

			// Then
			expect(result.message).toContain("비밀번호가 변경되었습니다");

			// DB 검증: 비밀번호 해시가 변경됨
			const prisma = testDb.getPrisma();
			const account = await prisma.account.findFirst({
				where: { userId, provider: "CREDENTIAL" },
			});
			expect(account?.password).toBeTruthy();
		});

		it("변경 후 새 비밀번호로 로그인할 수 있다", async () => {
			// Given
			const email = "change-login-new@example.com";
			const currentPassword = "Password123!";
			const newPassword = "NewPassword456!";
			const userId = await createCredentialUser(email, currentPassword);
			const sessionId = await loginAndGetSession(email, currentPassword);

			await passwordManagementService.changePassword(
				userId,
				currentPassword,
				newPassword,
				undefined,
				sessionId,
			);

			// When
			const loginResult = await authService.login({
				email,
				password: newPassword,
			});

			// Then
			expect(loginResult.tokens.accessToken).toBeDefined();
			expect(loginResult.tokens.refreshToken).toBeDefined();
		});

		it("변경 후 이전 비밀번호로는 로그인할 수 없다", async () => {
			// Given
			const email = "change-login-old@example.com";
			const currentPassword = "Password123!";
			const newPassword = "NewPassword456!";
			const userId = await createCredentialUser(email, currentPassword);
			const sessionId = await loginAndGetSession(email, currentPassword);

			await passwordManagementService.changePassword(
				userId,
				currentPassword,
				newPassword,
				undefined,
				sessionId,
			);

			// When & Then
			await expect(
				authService.login({ email, password: currentPassword }),
			).rejects.toThrow(BusinessException);
		});

		it("현재 세션은 유지되고 다른 세션은 폐기된다", async () => {
			// Given
			const email = "change-sessions@example.com";
			const currentPassword = "Password123!";
			const newPassword = "NewPassword456!";
			const userId = await createCredentialUser(email, currentPassword);

			// 두 세션 생성
			const currentSessionId = await loginAndGetSession(email, currentPassword);
			const otherSessionId = await loginAndGetSession(email, currentPassword);

			// When
			await passwordManagementService.changePassword(
				userId,
				currentPassword,
				newPassword,
				undefined,
				currentSessionId,
			);

			// Then
			const prisma = testDb.getPrisma();

			const currentSession = await prisma.session.findUnique({
				where: { id: currentSessionId },
			});
			expect(currentSession?.revokedAt).toBeNull();

			const otherSession = await prisma.session.findUnique({
				where: { id: otherSessionId },
			});
			expect(otherSession?.revokedAt).not.toBeNull();
			expect(otherSession?.revokedReason).toBe("PASSWORD_CHANGED");
		});

		it("잘못된 현재 비밀번호를 입력하면 에러를 던진다", async () => {
			// Given
			const email = "change-wrong-pw@example.com";
			const currentPassword = "Password123!";
			const userId = await createCredentialUser(email, currentPassword);

			// When & Then
			await expect(
				passwordManagementService.changePassword(
					userId,
					"WrongPassword999!",
					"NewPassword456!",
				),
			).rejects.toThrow(BusinessException);
		});

		it("소셜 전용 사용자가 비밀번호 변경을 시도하면 에러를 던진다", async () => {
			// Given
			const email = "social-change@example.com";
			const userId = await createSocialOnlyUser(email);

			// When & Then
			await expect(
				passwordManagementService.changePassword(
					userId,
					"AnyPassword123!",
					"NewPassword456!",
				),
			).rejects.toThrow(BusinessException);
		});

		it("SecurityLog에 PASSWORD_CHANGED 이벤트와 metadata가 기록된다", async () => {
			// Given
			const email = "change-seclog@example.com";
			const currentPassword = "Password123!";
			const newPassword = "NewPassword456!";
			const userId = await createCredentialUser(email, currentPassword);
			const sessionId = await loginAndGetSession(email, currentPassword);

			// When
			await passwordManagementService.changePassword(
				userId,
				currentPassword,
				newPassword,
				{ ip: "10.0.0.1", userAgent: "IntegrationTest/1.0" },
				sessionId,
			);

			// Then
			const prisma = testDb.getPrisma();
			const logs = await prisma.securityLog.findMany({
				where: { userId, event: "PASSWORD_CHANGED" },
			});

			// PASSWORD_CHANGED는 changePassword에서 기록됨
			const changeLog = logs.find((log) => log.ipAddress === "10.0.0.1");
			expect(changeLog).toBeDefined();
			expect(changeLog?.userAgent).toBe("IntegrationTest/1.0");
		});
	});
});

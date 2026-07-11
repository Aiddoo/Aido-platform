/**
 * 비밀번호 재설정 통합 테스트 (Testcontainers)
 *
 * @description
 * AuthService.forgotPassword() 및 AuthService.resetPassword()가
 * 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 *
 * 통합 테스트의 목적:
 * - AuthService -> Repository -> Prisma -> PostgreSQL 전체 스택 검증
 * - forgotPassword → resetPassword → 새 비밀번호 로그인 전체 플로우
 * - 세션 무효화 및 SecurityLog 기록 확인
 * - 보안: 존재하지 않는 이메일 동일 응답
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test auth-password-reset.integration-spec
 * ```
 */

import type { TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { AuthService } from "@/auth/application/services/auth.service";
import { PasswordManagementService } from "@/auth/application/services/password-management.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("비밀번호 재설정 통합 테스트 (실제 DB)", () => {
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
		jest.clearAllMocks();
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
				userTag: `TAG${Date.now().toString(36).slice(-5).toUpperCase()}`,
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

	/**
	 * 이메일/비밀번호 사용자 생성 헬퍼 (register + verify-email 시뮬레이션)
	 * @returns userId
	 */
	async function createCredentialUser(
		email: string,
		password: string,
	): Promise<string> {
		// 회원가입
		const registerResult = await authService.register({
			email,
			password,
			passwordConfirm: password,
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
		});

		// 이메일 인증
		const verifyCode = getCode(email);
		await authService.verifyEmail({ email, code: verifyCode });

		fakeEmailService.clear();

		return registerResult.userId;
	}

	describe("forgotPassword", () => {
		it("등록된 사용자에게 비밀번호 재설정 코드를 이메일로 발송한다", async () => {
			// Given
			const email = "reset-code@example.com";
			await createCredentialUser(email, "Password123!");

			// When
			const result = await passwordManagementService.forgotPassword(email);

			// Then
			expect(result.message).toBeDefined();
			expect(fakeEmailService.hasSentTo(email)).toBe(true);
			expect(fakeEmailService.getLastCode(email)).toMatch(/^\d{6}$/);
		});

		it("존재하지 않는 이메일도 동일한 응답을 반환하고 이메일을 발송하지 않는다 (보안)", async () => {
			// Given
			const email = "nonexistent@example.com";

			// When
			const result = await passwordManagementService.forgotPassword(email);

			// Then
			expect(result.message).toBeDefined();
			expect(fakeEmailService.hasSentTo(email)).toBe(false);
			expect(fakeEmailService.getSentCount()).toBe(0);
		});
	});

	describe("resetPassword", () => {
		it("인증 코드 확인 후 비밀번호를 재설정한다", async () => {
			// Given
			const email = "reset-pw@example.com";
			const originalPassword = "Password123!";
			await createCredentialUser(email, originalPassword);

			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);

			// When
			const result = await passwordManagementService.resetPassword(
				email,
				code,
				"NewPassword456!",
			);

			// Then
			expect(result.message).toContain("비밀번호가 재설정되었습니다");

			// DB 검증: 비밀번호 해시가 변경됨
			const prisma = testDb.getPrisma();
			const account = await prisma.account.findFirst({
				where: {
					user: { email },
					provider: "CREDENTIAL",
				},
			});
			expect(account?.password).toBeTruthy();
		});

		it("재설정 후 새 비밀번호로 로그인할 수 있다", async () => {
			// Given
			const email = "reset-login@example.com";
			const originalPassword = "Password123!";
			const newPassword = "NewPassword456!";
			await createCredentialUser(email, originalPassword);

			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);
			await passwordManagementService.resetPassword(email, code, newPassword);

			// When
			const loginResult = await authService.login({
				email,
				password: newPassword,
			});

			// Then
			expect(loginResult.tokens.accessToken).toBeDefined();
			expect(loginResult.tokens.refreshToken).toBeDefined();
		});

		it("재설정 후 이전 비밀번호로는 로그인할 수 없다", async () => {
			// Given
			const email = "reset-old-pw@example.com";
			const originalPassword = "Password123!";
			const newPassword = "NewPassword456!";
			await createCredentialUser(email, originalPassword);

			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);
			await passwordManagementService.resetPassword(email, code, newPassword);

			// When & Then
			await expect(
				authService.login({ email, password: originalPassword }),
			).rejects.toThrow(ApplicationException);
		});

		it("재설정 후 모든 세션이 무효화된다", async () => {
			// Given
			const email = "reset-sessions@example.com";
			const originalPassword = "Password123!";
			await createCredentialUser(email, originalPassword);

			// 로그인하여 세션 생성
			await authService.login({ email, password: originalPassword });
			await authService.login({ email, password: originalPassword });

			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);

			// When
			await passwordManagementService.resetPassword(
				email,
				code,
				"NewPassword456!",
			);

			// Then - 모든 세션의 revokedAt이 설정됨
			const prisma = testDb.getPrisma();
			const user = await prisma.user.findUnique({ where: { email } });
			const sessions = await prisma.session.findMany({
				where: { userId: user?.id },
			});

			for (const session of sessions) {
				expect(session.revokedAt).not.toBeNull();
				expect(session.revokedReason).toBe("PASSWORD_RESET");
			}
		});

		it("SecurityLog에 PASSWORD_CHANGED 이벤트가 기록된다", async () => {
			// Given
			const email = "reset-seclog@example.com";
			await createCredentialUser(email, "Password123!");

			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);

			// When
			await passwordManagementService.resetPassword(
				email,
				code,
				"NewPassword456!",
			);

			// Then
			const prisma = testDb.getPrisma();
			const user = await prisma.user.findUnique({ where: { email } });
			const logs = await prisma.securityLog.findMany({
				where: { userId: user?.id, event: "PASSWORD_CHANGED" },
			});
			expect(logs.length).toBeGreaterThanOrEqual(1);

			const resetLog = logs.find(
				(log) =>
					log.metadata &&
					typeof log.metadata === "object" &&
					(log.metadata as Record<string, unknown>).reason === "PASSWORD_RESET",
			);
			expect(resetLog).toBeDefined();
		});

		it("소셜 전용 사용자가 비밀번호 재설정을 시도하면 에러를 던진다", async () => {
			// Given - 소셜 전용 사용자 (Credential 계정 없음)
			const email = "social-only-reset@example.com";
			await createSocialOnlyUser(email);

			// forgotPassword는 보안상 동일 응답 (에러 없음)
			await passwordManagementService.forgotPassword(email);
			const code = getCode(email);

			// When & Then - resetPassword에서 USER_0613 에러
			await expect(
				passwordManagementService.resetPassword(email, code, "NewPassword456!"),
			).rejects.toThrow(ApplicationException);
		});

		it("잘못된 인증 코드로 재설정 시 에러를 던진다", async () => {
			// Given
			const email = "reset-wrong-code@example.com";
			await createCredentialUser(email, "Password123!");

			await passwordManagementService.forgotPassword(email);

			// When & Then
			await expect(
				passwordManagementService.resetPassword(
					email,
					"000000",
					"NewPassword456!",
				),
			).rejects.toThrow(ApplicationException);
		});
	});
});

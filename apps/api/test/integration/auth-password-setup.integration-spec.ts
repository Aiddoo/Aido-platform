/**
 * 비밀번호 설정 통합 테스트 (Testcontainers)
 *
 * @description
 * AuthService.requestPasswordSetupCode() 및 AuthService.setPassword()가
 * 실제 PostgreSQL DB와 함께 올바르게 작동하는지 검증합니다.
 *
 * 통합 테스트의 목적:
 * - AuthService -> Repository -> Prisma -> PostgreSQL 전체 스택 검증
 * - 소셜 전용 사용자의 비밀번호 설정 플로우
 * - CREDENTIAL 계정 생성 및 SecurityLog 기록
 * - 비밀번호 설정 후 이메일 로그인 가능 여부
 *
 * 실행 조건:
 * - Docker가 실행 중이어야 함 (Testcontainers 사용)
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test auth-password-setup.integration-spec
 * ```
 */

import type { TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { AuthService } from "@/auth/services/auth.service";
import { PasswordManagementService } from "@/auth/services/password-management.service";
import { BusinessException } from "@/shared/application/exceptions";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";
import { createAuthTestModule } from "./helpers/auth-test-module.factory";

describe("비밀번호 설정 통합 테스트 (실제 DB)", () => {
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
	 * CREDENTIAL 계정 없이 소셜 계정만 가진 사용자를 생성합니다.
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

	describe("requestPasswordSetupCode", () => {
		it("소셜 전용 사용자에게 비밀번호 설정 코드를 발송한다", async () => {
			// Given
			const email = "social-setup@example.com";
			const userId = await createSocialOnlyUser(email);

			// When
			const result =
				await passwordManagementService.requestPasswordSetupCode(userId);

			// Then
			expect(result.message).toBeDefined();
			expect(fakeEmailService.hasSentTo(email)).toBe(true);
			expect(fakeEmailService.getLastCode(email)).toMatch(/^\d{6}$/);
		});

		it("CREDENTIAL 계정이 이미 있으면 에러를 던진다", async () => {
			// Given - 소셜 사용자 생성 후 비밀번호 설정 완료
			const email = "already-has-pw@example.com";
			const userId = await createSocialOnlyUser(email);

			// 비밀번호 설정 코드 요청 및 설정
			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			await passwordManagementService.setPassword(userId, code, "NewPassword1");

			// When & Then
			await expect(
				passwordManagementService.requestPasswordSetupCode(userId),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("setPassword", () => {
		it("인증 코드 확인 후 CREDENTIAL 계정을 생성한다", async () => {
			// Given
			const email = "set-pw-test@example.com";
			const userId = await createSocialOnlyUser(email);

			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			// When
			const result = await passwordManagementService.setPassword(
				userId,
				code,
				"NewPassword1",
			);

			// Then
			expect(result.message).toBeDefined();

			// DB 검증: CREDENTIAL 계정 생성됨
			const prisma = testDb.getPrisma();
			const accounts = await prisma.account.findMany({
				where: { userId },
			});

			const credentialAccount = accounts.find(
				(a) => a.provider === "CREDENTIAL",
			);
			expect(credentialAccount).toBeDefined();
			expect(credentialAccount?.password).toBeTruthy();
		});

		it("비밀번호 설정 후 SecurityLog에 PASSWORD_SETUP 이벤트가 기록된다", async () => {
			// Given
			const email = "seclog-pw-test@example.com";
			const userId = await createSocialOnlyUser(email);

			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			// When
			await passwordManagementService.setPassword(
				userId,
				code,
				"NewPassword1",
				{
					ip: "192.168.1.1",
					userAgent: "IntegrationTest/1.0",
				},
			);

			// Then
			const prisma = testDb.getPrisma();
			const logs = await prisma.securityLog.findMany({
				where: { userId, event: "PASSWORD_SETUP" },
			});
			expect(logs).toHaveLength(1);
			expect(logs[0]?.ipAddress).toBe("192.168.1.1");
			expect(logs[0]?.userAgent).toBe("IntegrationTest/1.0");
		});

		it("비밀번호 설정 후 이메일 로그인이 가능하다", async () => {
			// Given - 소셜 사용자에게 비밀번호 설정
			const email = "login-after-setup@example.com";
			const password = "NewPassword1";
			const userId = await createSocialOnlyUser(email);

			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			await passwordManagementService.setPassword(userId, code, password);

			// When - 이메일/비밀번호로 로그인
			const loginResult = await authService.login({ email, password });

			// Then
			expect(loginResult.tokens.accessToken).toBeDefined();
			expect(loginResult.tokens.refreshToken).toBeDefined();
		});

		it("잘못된 인증 코드로 비밀번호 설정 시 에러를 던진다", async () => {
			// Given
			const email = "wrong-code-test@example.com";
			const userId = await createSocialOnlyUser(email);

			await passwordManagementService.requestPasswordSetupCode(userId);

			// When & Then
			await expect(
				passwordManagementService.setPassword(userId, "000000", "NewPassword1"),
			).rejects.toThrow(BusinessException);
		});

		it("이미 CREDENTIAL 계정이 있으면 에러를 던진다", async () => {
			// Given - 비밀번호 설정 완료
			const email = "duplicate-setup@example.com";
			const userId = await createSocialOnlyUser(email);

			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			await passwordManagementService.setPassword(userId, code, "NewPassword1");

			// When & Then - 다시 설정 시도 (코드 요청도 실패해야 함)
			await expect(
				passwordManagementService.requestPasswordSetupCode(userId),
			).rejects.toThrow(BusinessException);
		});

		it("기존 소셜 계정은 유지된다", async () => {
			// Given
			const email = "keep-social@example.com";
			const userId = await createSocialOnlyUser(email, "KAKAO");

			await passwordManagementService.requestPasswordSetupCode(userId);
			const code = getCode(email);

			// When
			await passwordManagementService.setPassword(userId, code, "NewPassword1");

			// Then - KAKAO 계정과 CREDENTIAL 계정 모두 존재
			const prisma = testDb.getPrisma();
			const accounts = await prisma.account.findMany({
				where: { userId },
				orderBy: { provider: "asc" },
			});

			expect(accounts).toHaveLength(2);
			const providers = accounts.map((a) => a.provider);
			expect(providers).toContain("CREDENTIAL");
			expect(providers).toContain("KAKAO");
		});
	});
});

import type { TestingModule } from "@nestjs/testing";
import { and, eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { LoginWithPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-password.use-case";
import { RegisterUseCase } from "#api/modules/identity/auth/application/use-cases/register.use-case";
import { RequestPasswordResetUseCase } from "#api/modules/identity/auth/application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/reset-password.use-case";
import { VerifyEmailUseCase } from "#api/modules/identity/auth/application/use-cases/verify-email.use-case";
import { requireRecord } from "#api/platform/database/database-error.util";
import { securityLog, session as sessionTable } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/application/application.exception";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase } from "../setup/test-database.js";
import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

describe("비밀번호 재설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let register: RegisterUseCase;
  let verifyEmail: VerifyEmailUseCase;
  let requestPasswordReset: RequestPasswordResetUseCase;
  let resetPassword: ResetPasswordUseCase;
  let loginWithPassword: LoginWithPasswordUseCase;
  let fakeEmailService: FakeEmailService;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.start();
    fakeEmailService = new FakeEmailService();

    module = await createAuthTestModule(testDb.getClient(), fakeEmailService);
    register = module.get(RegisterUseCase);
    verifyEmail = module.get(VerifyEmailUseCase);
    requestPasswordReset = module.get(RequestPasswordResetUseCase);
    resetPassword = module.get(ResetPasswordUseCase);
    loginWithPassword = module.get(LoginWithPasswordUseCase);
  }, 60_000);

  beforeEach(async () => {
    suppressLogger();
    await testDb.cleanup();
    fakeEmailService.clear();
  });

  afterAll(async () => {
    try {
      if (module) {
        await module.close();
      }
    } finally {
      if (testDb) {
        await testDb.stop();
      }
    }
  });

  function getCode(email: string): string {
    const code = fakeEmailService.getLastCode(email);
    if (code == null) {
      throw new Error(`No code found for ${email}`);
    }
    return code;
  }

  async function createSocialOnlyUser(
    email: string,
    provider: "GOOGLE" | "KAKAO" | "NAVER" | "APPLE" = "GOOGLE",
  ): Promise<string> {
    const userFixture = UserFixture.create({ email });
    const user = await createUserDatabaseFixture(testDb.getClient(), userFixture, {
      accounts: [
        omit(
          AccountFixture.create({
            userId: userFixture.id,
            provider,
            providerAccountId: `${provider.toLowerCase()}-${userFixture.id}`,
          }),
          ["id", "userId"],
        ),
      ],
    });
    return user.id;
  }

  async function createCredentialUser(email: string, password: string): Promise<string> {
    // 회원가입
    const registerResult = await register.execute({
      email,
      password,
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    });

    // 이메일 인증
    const verifyCode = getCode(email);
    await verifyEmail.execute({ email, code: verifyCode });

    fakeEmailService.clear();

    return registerResult.userId;
  }

  describe("forgotPassword", () => {
    it("등록된 사용자에게 비밀번호 재설정 코드를 이메일로 발송한다", async () => {
      // Given
      const email = "reset-code@example.com";
      await createCredentialUser(email, "Password123!");

      // When
      const result = await requestPasswordReset.execute({ email });

      // Then
      expect(result.message).toBeDefined();
      expect(fakeEmailService.hasSentTo(email)).toBe(true);
      expect(fakeEmailService.getLastCode(email)).toMatch(/^\d{6}$/);
    });

    it("존재하지 않는 이메일도 동일한 응답을 반환하고 이메일을 발송하지 않는다 (보안)", async () => {
      // Given
      const email = "nonexistent@example.com";

      // When
      const result = await requestPasswordReset.execute({ email });

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

      await requestPasswordReset.execute({ email });
      const code = getCode(email);

      // When
      const result = await resetPassword.execute({ email, code, newPassword: "NewPassword456!" });

      // Then
      expect(result.message).toContain("비밀번호가 재설정되었습니다");

      const account = await testDb.getClient().query.account.findFirst({
        where: { provider: "CREDENTIAL", user: { email } },
      });
      expect(account?.password).toBeTruthy();
    });

    it("재설정 후 새 비밀번호로 로그인할 수 있다", async () => {
      // Given
      const email = "reset-login@example.com";
      const originalPassword = "Password123!";
      const newPassword = "NewPassword456!";
      await createCredentialUser(email, originalPassword);

      await requestPasswordReset.execute({ email });
      const code = getCode(email);
      await resetPassword.execute({ email, code, newPassword });

      // When
      const loginResult = await loginWithPassword.execute({
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

      await requestPasswordReset.execute({ email });
      const code = getCode(email);
      await resetPassword.execute({ email, code, newPassword });

      // When & Then
      await expect(
        loginWithPassword.execute({ email, password: originalPassword }),
      ).rejects.toThrow(ApplicationException);
    });

    it("재설정 후 모든 세션이 무효화된다", async () => {
      // Given
      const email = "reset-sessions@example.com";
      const originalPassword = "Password123!";
      await createCredentialUser(email, originalPassword);
      await loginWithPassword.execute({ email, password: originalPassword });
      await loginWithPassword.execute({ email, password: originalPassword });

      await requestPasswordReset.execute({ email });
      const code = getCode(email);

      // When
      await resetPassword.execute({ email, code, newPassword: "NewPassword456!" });

      // Then
      const client = testDb.getClient();
      const user = await client.query.user.findFirst({ where: { email } });
      const sessions = await client
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, requireRecord(user).id));

      for (const session of sessions) {
        expect(session.revokedAt).not.toBeNull();
        expect(session.revokedReason).toBe("PASSWORD_RESET");
      }
    });

    it("SecurityLog에 PASSWORD_CHANGED 이벤트가 기록된다", async () => {
      // Given
      const email = "reset-seclog@example.com";
      await createCredentialUser(email, "Password123!");

      await requestPasswordReset.execute({ email });
      const code = getCode(email);

      // When
      await resetPassword.execute({ email, code, newPassword: "NewPassword456!" });

      // Then
      const client = testDb.getClient();
      const user = await client.query.user.findFirst({ where: { email } });
      const logs = await client
        .select()
        .from(securityLog)
        .where(
          and(
            eq(securityLog.userId, requireRecord(user).id),
            eq(securityLog.event, "PASSWORD_CHANGED"),
          ),
        );
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const resetLog = logs.find(
        (log) =>
          log.metadata != null &&
          typeof log.metadata === "object" &&
          "reason" in log.metadata &&
          log.metadata.reason === "PASSWORD_RESET",
      );
      expect(resetLog).toBeDefined();
    });

    it("소셜 전용 사용자가 비밀번호 재설정을 시도하면 에러를 던진다", async () => {
      // Given - 소셜 전용 사용자 (Credential 계정 없음)
      const email = "social-only-reset@example.com";
      await createSocialOnlyUser(email);

      // forgotPassword는 보안상 동일 응답 (에러 없음)
      await requestPasswordReset.execute({ email });
      const code = getCode(email);

      // When & Then - resetPassword에서 USER_0613 에러
      await expect(
        resetPassword.execute({ email, code, newPassword: "NewPassword456!" }),
      ).rejects.toThrow(ApplicationException);
    });

    it("잘못된 인증 코드로 재설정 시 에러를 던진다", async () => {
      // Given
      const email = "reset-wrong-code@example.com";
      await createCredentialUser(email, "Password123!");

      await requestPasswordReset.execute({ email });

      // When & Then
      await expect(
        resetPassword.execute({ email, code: "000000", newPassword: "NewPassword456!" }),
      ).rejects.toThrow(ApplicationException);
    });
  });
});

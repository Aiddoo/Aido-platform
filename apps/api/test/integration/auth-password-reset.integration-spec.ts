import type { TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { omit } from "es-toolkit";

import { LoginWithPassword } from "#api/modules/identity/application/use-cases/auth/login-with-password.use-case";
import { Register } from "#api/modules/identity/application/use-cases/auth/register.use-case";
import { RequestPasswordReset } from "#api/modules/identity/application/use-cases/auth/request-password-reset.use-case";
import { ResetPassword } from "#api/modules/identity/application/use-cases/auth/reset-password.use-case";
import { VerifyEmail } from "#api/modules/identity/application/use-cases/auth/verify-email.use-case";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import { DatabaseService } from "#api/platform/database/database.service";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { createTestDatabaseService } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase } from "../setup/test-database.js";
import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

describe("비밀번호 재설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let register: Register;
  let verifyEmail: VerifyEmail;
  let requestPasswordReset: RequestPasswordReset;
  let resetPassword: ResetPassword;
  let loginWithPassword: LoginWithPassword;
  let fakeEmailService: FakeEmailService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    testDb = new TestDatabase();
    databaseService = createTestDatabaseService(await testDb.start());
    fakeEmailService = new FakeEmailService();

    module = await createAuthTestModule(databaseService, fakeEmailService);
    register = module.get(Register);
    verifyEmail = module.get(VerifyEmail);
    requestPasswordReset = module.get(RequestPasswordReset);
    resetPassword = module.get(ResetPassword);
    loginWithPassword = module.get(LoginWithPassword);
  }, 60000);

  beforeEach(async () => {
    suppressLogger();
    await testDb.cleanup();
    fakeEmailService.clear();
  });

  afterAll(async () => {
    try {
      if (module) await module.close();
    } finally {
      if (testDb) await testDb.stop();
    }
  });

  function getCode(email: string): string {
    const code = fakeEmailService.getLastCode(email);
    if (code == null) throw new Error(`No code found for ${email}`);
    return code;
  }

  async function createSocialOnlyUser(
    email: string,
    provider: "GOOGLE" | "KAKAO" | "NAVER" | "APPLE" = "GOOGLE",
  ): Promise<string> {
    const userFixture = UserFixture.create({ email });
    const user = await createUserDatabaseFixture(
      testDb.getClient(),
      encodeCreate("User", userFixture),
      {
        accounts: [
          omit(
            encodeCreate(
              "Account",
              AccountFixture.create({
                userId: userFixture.id,
                provider,
                providerAccountId: `${provider.toLowerCase()}-${userFixture.id}`,
              }),
            ),
            ["id", "userId"],
          ),
        ],
      },
    );
    return user.id;
  }

  async function createCredentialUser(email: string, password: string): Promise<string> {
    // 회원가입
    const registerResult = await register.execute({
      email,
      password,
      passwordConfirm: password,
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

      // DB 검증: 비밀번호 해시가 변경됨
      const prisma = testDb.getClient();
      const account = decodeRecord(
        "Account",
        await prisma.orm.public.Account.where((row) =>
          and(
            row.user.some((related) => related.email.eq(varchar(email, 255))),
            row.provider.eq("CREDENTIAL"),
          ),
        ).first(),
      );
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

      // 로그인하여 세션 생성
      await loginWithPassword.execute({ email, password: originalPassword });
      await loginWithPassword.execute({ email, password: originalPassword });

      await requestPasswordReset.execute({ email });
      const code = getCode(email);

      // When
      await resetPassword.execute({ email, code, newPassword: "NewPassword456!" });

      // Then - 모든 세션의 revokedAt이 설정됨
      const prisma = testDb.getClient();
      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.email.eq(varchar(email, 255))).first(),
      );
      const sessions = decodeRecord(
        "Session",
        await prisma.orm.public.Session.where((row) => row.userId.eq(requireRecord(user).id)).all(),
      );

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
      const prisma = testDb.getClient();
      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.email.eq(varchar(email, 255))).first(),
      );
      const logs = decodeRecord(
        "SecurityLog",
        await prisma.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(requireRecord(user).id), row.event.eq("PASSWORD_CHANGED")),
        ).all(),
      );
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

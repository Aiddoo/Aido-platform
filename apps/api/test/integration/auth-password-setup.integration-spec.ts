import type { TestingModule } from "@nestjs/testing";
import { omit } from "es-toolkit";

import { LoginWithPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-password.use-case";
import { RequestPasswordSetupCodeUseCase } from "#api/modules/identity/auth/application/use-cases/request-password-setup-code.use-case";
import { SetPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/set-password.use-case";
import { ApplicationException } from "#api/shared/application/application.exception";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase } from "../setup/test-database.js";
import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

describe("비밀번호 설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let requestPasswordSetupCode: RequestPasswordSetupCodeUseCase;
  let setPassword: SetPasswordUseCase;
  let loginWithPassword: LoginWithPasswordUseCase;
  let fakeEmailService: FakeEmailService;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.start();
    fakeEmailService = new FakeEmailService();

    module = await createAuthTestModule(testDb.getClient(), fakeEmailService);
    requestPasswordSetupCode = module.get(RequestPasswordSetupCodeUseCase);
    setPassword = module.get(SetPasswordUseCase);
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

  describe("requestPasswordSetupCode", () => {
    it("소셜 전용 사용자에게 비밀번호 설정 코드를 발송한다", async () => {
      // Given
      const email = "social-setup@example.com";
      const userId = await createSocialOnlyUser(email);

      // When
      const result = await requestPasswordSetupCode.execute({ userId });

      // Then
      expect(result.message).toBeDefined();
      expect(fakeEmailService.hasSentTo(email)).toBe(true);
      expect(fakeEmailService.getLastCode(email)).toMatch(/^\d{6}$/);
    });

    it("CREDENTIAL 계정이 이미 있으면 에러를 던진다", async () => {
      // Given
      const email = "already-has-pw@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // When
      await expect(requestPasswordSetupCode.execute({ userId })).rejects.toThrow(
        ApplicationException,
      );
    });
  });

  describe("setPassword", () => {
    it("인증 코드 확인 후 CREDENTIAL 계정을 생성한다", async () => {
      // Given
      const email = "set-pw-test@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      // When
      const result = await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // Then
      expect(result.message).toBeDefined();

      const accounts = await testDb.getClient().query.account.findMany({ where: { userId } });

      const credentialAccount = accounts.find((a) => a.provider === "CREDENTIAL");
      expect(credentialAccount).toBeDefined();
      expect(credentialAccount?.password).toBeTruthy();
    });

    it("비밀번호 설정 후 SecurityLog에 PASSWORD_SETUP 이벤트가 기록된다", async () => {
      // Given
      const email = "seclog-pw-test@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      // When
      await setPassword.execute({
        userId,
        code,
        newPassword: "NewPassword1",
        metadata: {
          ip: "192.168.1.1",
          userAgent: "IntegrationTest/1.0",
        },
      });

      // Then
      const logs = await testDb.getClient().query.securityLog.findMany({
        where: { userId, event: "PASSWORD_SETUP" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("192.168.1.1");
      expect(logs[0]?.userAgent).toBe("IntegrationTest/1.0");
    });

    it("비밀번호 설정 후 이메일 로그인이 가능하다", async () => {
      // Given
      const email = "login-after-setup@example.com";
      const password = "NewPassword1";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: password });

      // When
      const loginResult = await loginWithPassword.execute({ email, password });

      // Then
      expect(loginResult.tokens.accessToken).toBeDefined();
      expect(loginResult.tokens.refreshToken).toBeDefined();
    });

    it("잘못된 인증 코드로 비밀번호 설정 시 에러를 던진다", async () => {
      // Given
      const email = "wrong-code-test@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });

      // When
      await expect(
        setPassword.execute({ userId, code: "000000", newPassword: "NewPassword1" }),
      ).rejects.toThrow(ApplicationException);
    });

    it("이미 CREDENTIAL 계정이 있으면 에러를 던진다", async () => {
      // Given
      const email = "duplicate-setup@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // When
      await expect(requestPasswordSetupCode.execute({ userId })).rejects.toThrow(
        ApplicationException,
      );
    });

    it("기존 소셜 계정은 유지된다", async () => {
      // Given
      const email = "keep-social@example.com";
      const userId = await createSocialOnlyUser(email, "KAKAO");

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      // When
      await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // Then
      const accounts = await testDb.getClient().query.account.findMany({
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

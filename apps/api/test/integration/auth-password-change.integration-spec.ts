import type { TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { omit } from "es-toolkit";

import { ChangePassword } from "#api/modules/identity/application/use-cases/auth/change-password.use-case";
import { LoginWithPassword } from "#api/modules/identity/application/use-cases/auth/login-with-password.use-case";
import { Register } from "#api/modules/identity/application/use-cases/auth/register.use-case";
import { VerifyEmail } from "#api/modules/identity/application/use-cases/auth/verify-email.use-case";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { DatabaseService } from "#api/platform/database/database.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { createTestDatabaseService } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase } from "../setup/test-database.js";
import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

describe("비밀번호 변경 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let register: Register;
  let verifyEmail: VerifyEmail;
  let loginWithPassword: LoginWithPassword;
  let changePassword: ChangePassword;
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
    loginWithPassword = module.get(LoginWithPassword);
    changePassword = module.get(ChangePassword);
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

  async function createCredentialUser(email: string, password: string): Promise<string> {
    const registerResult = await register.execute({
      email,
      password,
      passwordConfirm: password,
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    });

    const verifyCode = getCode(email);
    await verifyEmail.execute({ email, code: verifyCode });

    fakeEmailService.clear();

    return registerResult.userId;
  }

  async function loginAndGetSession(email: string, password: string): Promise<string> {
    const result = await loginWithPassword.execute({ email, password });
    return result.sessionId;
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

  describe("changePassword", () => {
    it("현재 비밀번호 확인 후 새 비밀번호로 변경한다", async () => {
      // Given
      const email = "change-pw@example.com";
      const currentPassword = "Password123!";
      const newPassword = "NewPassword456!";
      const userId = await createCredentialUser(email, currentPassword);

      const sessionId = await loginAndGetSession(email, currentPassword);

      // When
      const result = await changePassword.execute({
        userId,
        currentPassword,
        newPassword,
        currentSessionId: sessionId,
      });

      // Then
      expect(result.message).toContain("비밀번호가 변경되었습니다");

      // DB 검증: 비밀번호 해시가 변경됨
      const prisma = testDb.getClient();
      const account = decodeRecord(
        "Account",
        await prisma.orm.public.Account.where((row) =>
          and(row.userId.eq(userId), row.provider.eq("CREDENTIAL")),
        ).first(),
      );
      expect(account?.password).toBeTruthy();
    });

    it("변경 후 새 비밀번호로 로그인할 수 있다", async () => {
      // Given
      const email = "change-login-new@example.com";
      const currentPassword = "Password123!";
      const newPassword = "NewPassword456!";
      const userId = await createCredentialUser(email, currentPassword);
      const sessionId = await loginAndGetSession(email, currentPassword);

      await changePassword.execute({
        userId,
        currentPassword,
        newPassword,
        currentSessionId: sessionId,
      });

      // When
      const loginResult = await loginWithPassword.execute({
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

      await changePassword.execute({
        userId,
        currentPassword,
        newPassword,
        currentSessionId: sessionId,
      });

      // When & Then
      await expect(loginWithPassword.execute({ email, password: currentPassword })).rejects.toThrow(
        ApplicationException,
      );
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
      await changePassword.execute({ userId, currentPassword, newPassword, currentSessionId });

      // Then
      const prisma = testDb.getClient();

      const currentSession = decodeRecord(
        "Session",
        await prisma.orm.public.Session.where((row) => row.id.eq(currentSessionId)).first(),
      );
      expect(currentSession?.revokedAt).toBeNull();

      const otherSession = decodeRecord(
        "Session",
        await prisma.orm.public.Session.where((row) => row.id.eq(otherSessionId)).first(),
      );
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
        changePassword.execute({
          userId,
          currentPassword: "WrongPassword999!",
          newPassword: "NewPassword456!",
        }),
      ).rejects.toThrow(ApplicationException);
    });

    it("소셜 전용 사용자가 비밀번호 변경을 시도하면 에러를 던진다", async () => {
      // Given
      const email = "social-change@example.com";
      const userId = await createSocialOnlyUser(email);

      // When & Then
      await expect(
        changePassword.execute({
          userId,
          currentPassword: "AnyPassword123!",
          newPassword: "NewPassword456!",
        }),
      ).rejects.toThrow(ApplicationException);
    });

    it("SecurityLog에 PASSWORD_CHANGED 이벤트와 metadata가 기록된다", async () => {
      // Given
      const email = "change-seclog@example.com";
      const currentPassword = "Password123!";
      const newPassword = "NewPassword456!";
      const userId = await createCredentialUser(email, currentPassword);
      const sessionId = await loginAndGetSession(email, currentPassword);

      // When
      await changePassword.execute({
        userId,
        currentPassword,
        newPassword,
        metadata: { ip: "10.0.0.1", userAgent: "IntegrationTest/1.0" },
        currentSessionId: sessionId,
      });

      // Then
      const prisma = testDb.getClient();
      const logs = decodeRecord(
        "SecurityLog",
        await prisma.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(userId), row.event.eq("PASSWORD_CHANGED")),
        ).all(),
      );

      // PASSWORD_CHANGED는 changePassword에서 기록됨
      const changeLog = logs.find((log) => log.ipAddress === "10.0.0.1");
      expect(changeLog).toBeDefined();
      expect(changeLog?.userAgent).toBe("IntegrationTest/1.0");
    });
  });
});

import type { TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { omit } from "es-toolkit";

import { LoginWithPassword } from "#api/modules/identity/application/use-cases/auth/login-with-password.use-case";
import { RequestPasswordSetupCode } from "#api/modules/identity/application/use-cases/auth/request-password-setup-code.use-case";
import { SetPassword } from "#api/modules/identity/application/use-cases/auth/set-password.use-case";
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

describe("비밀번호 설정 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let requestPasswordSetupCode: RequestPasswordSetupCode;
  let setPassword: SetPassword;
  let loginWithPassword: LoginWithPassword;
  let fakeEmailService: FakeEmailService;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    testDb = new TestDatabase();
    databaseService = createTestDatabaseService(await testDb.start());
    fakeEmailService = new FakeEmailService();

    module = await createAuthTestModule(databaseService, fakeEmailService);
    requestPasswordSetupCode = module.get(RequestPasswordSetupCode);
    setPassword = module.get(SetPassword);
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
      // Given - 소셜 사용자 생성 후 비밀번호 설정 완료
      const email = "already-has-pw@example.com";
      const userId = await createSocialOnlyUser(email);

      // 비밀번호 설정 코드 요청 및 설정
      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // When & Then
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

      // DB 검증: CREDENTIAL 계정 생성됨
      const prisma = testDb.getClient();
      const accounts = decodeRecord(
        "Account",
        await prisma.orm.public.Account.where((row) => row.userId.eq(userId)).all(),
      );

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
      const prisma = testDb.getClient();
      const logs = decodeRecord(
        "SecurityLog",
        await prisma.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(userId), row.event.eq("PASSWORD_SETUP")),
        ).all(),
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("192.168.1.1");
      expect(logs[0]?.userAgent).toBe("IntegrationTest/1.0");
    });

    it("비밀번호 설정 후 이메일 로그인이 가능하다", async () => {
      // Given - 소셜 사용자에게 비밀번호 설정
      const email = "login-after-setup@example.com";
      const password = "NewPassword1";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: password });

      // When - 이메일/비밀번호로 로그인
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

      // When & Then
      await expect(
        setPassword.execute({ userId, code: "000000", newPassword: "NewPassword1" }),
      ).rejects.toThrow(ApplicationException);
    });

    it("이미 CREDENTIAL 계정이 있으면 에러를 던진다", async () => {
      // Given - 비밀번호 설정 완료
      const email = "duplicate-setup@example.com";
      const userId = await createSocialOnlyUser(email);

      await requestPasswordSetupCode.execute({ userId });
      const code = getCode(email);

      await setPassword.execute({ userId, code, newPassword: "NewPassword1" });

      // When & Then - 다시 설정 시도 (코드 요청도 실패해야 함)
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

      // Then - KAKAO 계정과 CREDENTIAL 계정 모두 존재
      const prisma = testDb.getClient();
      const accounts = decodeRecord(
        "Account",
        await prisma.orm.public.Account.where((row) => row.userId.eq(userId))
          .orderBy((row) => row.provider.asc())
          .all(),
      );

      expect(accounts).toHaveLength(2);
      const providers = accounts.map((a) => a.provider);
      expect(providers).toContain("CREDENTIAL");
      expect(providers).toContain("KAKAO");
    });
  });
});

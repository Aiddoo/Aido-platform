import { ACCOUNT_DELETION } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { vi } from "vitest";

import {
  ACCOUNT_NOTIFICATION_CLEANUP,
  ACCOUNT_TODO_COMMENT_CLEANUP,
} from "#api/modules/identity/application/ports/auth/account-cleanup.port";
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_CACHE,
  AUTH_EMAIL_SENDER,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_PASSWORD_HASHER,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_SESSION_REPOSITORY,
  AUTH_TOKEN_ISSUER,
  AUTH_USER_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
} from "#api/modules/identity/application/ports/auth/index";
import { VERIFICATION_CODE_SECURITY } from "#api/modules/identity/application/ports/auth/verification-code-security.port";
import { DeleteAccount } from "#api/modules/identity/application/use-cases/auth/delete-account.use-case";
import { LoginWithPassword } from "#api/modules/identity/application/use-cases/auth/login-with-password.use-case";
import { PurgeDeletedAccounts } from "#api/modules/identity/application/use-cases/auth/purge-deleted-accounts.use-case";
import { Register } from "#api/modules/identity/application/use-cases/auth/register.use-case";
import { RequestPasswordReset } from "#api/modules/identity/application/use-cases/auth/request-password-reset.use-case";
import { AuthCacheAdapter } from "#api/modules/identity/infrastructure/adapters/auth/auth-cache.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/infrastructure/adapters/auth/node-verification-code-security.adapter";
import { PasswordService } from "#api/modules/identity/infrastructure/adapters/auth/password.service";
import { TokenService } from "#api/modules/identity/infrastructure/adapters/auth/token.service";
import { DrizzleAccountRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-account.repository";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-login-attempt.repository";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-security-log.repository";
import { DrizzleSessionRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-session.repository";
import { DrizzleUserRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-user.repository";
import { DrizzleVerificationRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-verification.repository";
import { DrizzleUserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/drizzle-user-preference.repository";
import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { DefaultTodoCategorySeeder } from "#api/modules/planning/infrastructure/seeders/categories/default-todo-category.seeder";
import { CacheService } from "#api/platform/cache/cache.service";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { requireRecord } from "#api/platform/database/database-error.util";
import { DRIZZLE } from "#api/platform/database/database.client";
import { account, user as userTable } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  registerProvider,
  loginWithPasswordProvider,
  deleteAccountProvider,
  purgeDeletedAccountsProvider,
  restoreAccountProvider,
  issueLoginProvider,
  requestPasswordResetProvider,
  provisionUserProvider,
  sessionServiceProvider,
  verificationServiceProvider,
} from "../../src/modules/identity/identity-auth-application.providers.js";
import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase, type TestDatabaseClient } from "../setup/test-database.js";
import { provisioningSeederTestProvider } from "./helpers/provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./helpers/retention-enroller.provider.js";
import { sessionPushDeviceReleaserTestProvider } from "./helpers/session-push-device-releaser.provider.js";

describe("회원 탈퇴 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let register: Register;
  let loginWithPassword: LoginWithPassword;
  let requestPasswordReset: RequestPasswordReset;
  let deleteAccount: DeleteAccount;
  let purgeDeletedAccounts: PurgeDeletedAccounts;
  let testDb: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    testDb = new TestDatabase();
    client = await testDb.start();

    const transaction = createDatabaseTransactionFixture(client);
    module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [
        registerProvider,
        loginWithPasswordProvider,
        issueLoginProvider,
        provisionUserProvider,
        deleteAccountProvider,
        purgeDeletedAccountsProvider,
        restoreAccountProvider,
        {
          provide: ACCOUNT_NOTIFICATION_CLEANUP,
          useValue: {
            cleanupInTransaction: async () => ({ affectedUserIds: [] }),
            settleAfterCommit: async () => {},
          },
        },
        {
          provide: ACCOUNT_TODO_COMMENT_CLEANUP,
          useValue: {
            cleanupInTransaction: async () => ({ affectedTodoIds: [] }),
            settleAfterCommit: async () => {},
          },
        },
        PasswordService,
        requestPasswordResetProvider,
        sessionServiceProvider,
        TokenService,
        verificationServiceProvider,
        {
          provide: VERIFICATION_CODE_SECURITY,
          useClass: NodeVerificationCodeSecurityAdapter,
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: (value: string) => value,
            decryptSafe: (value: string) => value,
          },
        },
        DrizzleAccountRepository,
        DrizzleUserRepository,
        DrizzleSessionRepository,
        DrizzleSecurityLogRepository,
        DrizzleLoginAttemptRepository,
        DrizzleVerificationRepository,
        { provide: AUTH_USER_REPOSITORY, useExisting: DrizzleUserRepository },
        { provide: AUTH_ACCOUNT_REPOSITORY, useExisting: DrizzleAccountRepository },
        { provide: AUTH_SESSION_REPOSITORY, useExisting: DrizzleSessionRepository },
        {
          provide: AUTH_VERIFICATION_REPOSITORY,
          useExisting: DrizzleVerificationRepository,
        },
        {
          provide: AUTH_LOGIN_ATTEMPT_REPOSITORY,
          useExisting: DrizzleLoginAttemptRepository,
        },
        {
          provide: AUTH_SECURITY_LOG_REPOSITORY,
          useExisting: DrizzleSecurityLogRepository,
        },
        { provide: AUTH_PASSWORD_HASHER, useExisting: PasswordService },
        { provide: AUTH_TOKEN_ISSUER, useExisting: TokenService },
        { provide: AUTH_EMAIL_SENDER, useExisting: TransactionalEmailSender },
        AuthCacheAdapter,
        { provide: AUTH_CACHE, useExisting: AuthCacheAdapter },
        {
          provide: AUTH_REGISTRATION_NOTIFIER,
          useExisting: AdminEventNotifier,
        },
        DrizzleUserConsentRepository,
        DrizzleUserPreferenceRepository,
        DefaultTodoCategorySeeder,
        provisioningSeederTestProvider,
        retentionEnrollerTestProvider,
        sessionPushDeviceReleaserTestProvider,
        {
          provide: DRIZZLE,
          useValue: client,
        },
        {
          provide: TransactionHost,
          useValue: transaction.txHost,
        },
        {
          provide: UNIT_OF_WORK,
          useValue: transaction.uow,
        },
        {
          provide: TransactionalEmailSender,
          useClass: FakeEmailService,
        },
        {
          provide: CacheService,
          useFactory: () => {
            const cache = createMockCacheService();
            cache.wrap.mockImplementation((_key, _schema, factory) => factory());
            return cache;
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
                JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
                JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
                JWT_REFRESH_SECRET:
                  process.env.JWT_REFRESH_SECRET ?? "test-jwt-refresh-secret-for-integration",
                JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
              };
              return config[key];
            },
            jwtSecret: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
            jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
            jwtRefreshSecret:
              process.env.JWT_REFRESH_SECRET ?? "test-jwt-refresh-secret-for-integration",
            jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
            jwtConfig: {
              secret: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
              expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
              refreshSecret:
                process.env.JWT_REFRESH_SECRET ?? "test-jwt-refresh-secret-for-integration",
              refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
                JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
                JWT_REFRESH_SECRET:
                  process.env.JWT_REFRESH_SECRET ?? "test-jwt-refresh-secret-for-integration",
                JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
              };
              return config[key];
            },
          },
        },
        {
          provide: AdminEventNotifier,
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

    register = module.get(Register);
    loginWithPassword = module.get(LoginWithPassword);
    requestPasswordReset = module.get(RequestPasswordReset);
    deleteAccount = module.get(DeleteAccount);
    purgeDeletedAccounts = module.get(PurgeDeletedAccounts);
  }, 60000);

  beforeEach(async () => {
    suppressLogger();
    vi.clearAllMocks();
    await testDb.cleanup();
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

  async function createVerifiedCredentialUser(email: string, password: string): Promise<string> {
    const registerResult = await register.execute({
      email,
      password,
      passwordConfirm: password,
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    });

    await client
      .update(userTable)
      .set({ status: "ACTIVE", emailVerifiedAt: new Date() })
      .where(eq(userTable.id, registerResult.userId));

    return registerResult.userId;
  }

  describe("deleteAccount", () => {
    it("CREDENTIAL 계정: soft delete + 세션 폐기 + 보안 로그 기록", async () => {
      // Given
      const email = "delete-test@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);

      await loginWithPassword.execute({ email, password });

      // When
      const result = await deleteAccount.execute({ userId, password });

      // Then
      expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
      expect(result.deletedAt).toBeDefined();

      const user = await client.query.user.findFirst({ where: { id: userId } });
      expect(user?.deletedAt?.toISOString()).toBe(result.deletedAt);
      expect(user?.status).toBe("SUSPENDED");

      const sessions = await client.query.session.findMany({ where: { userId } });
      for (const session of sessions) {
        expect(session.revokedAt).not.toBeNull();
      }

      const logs = await client.query.securityLog.findMany({
        where: { userId, event: "ACCOUNT_DELETION_REQUESTED" },
      });
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it("소셜 전용 계정: 비밀번호 없이 탈퇴 처리", async () => {
      // Given
      const [created] = await client
        .insert(userTable)
        .values({
          email: "social-delete@example.com",
          userTag: "SODEL001",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        })
        .returning();
      const user = requireRecord(created);
      await client
        .insert(account)
        .values({ userId: user.id, provider: "GOOGLE", providerAccountId: "google-123" });

      // When
      const result = await deleteAccount.execute({ userId: user.id });

      // Then
      expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
      const deletedUser = await client.query.user.findFirst({ where: { id: user.id } });
      expect(deletedUser?.deletedAt).not.toBeNull();
    });

    it("유예 기간 내 credential 로그인 시 자동 복구", async () => {
      // Given
      const email = "login-after-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);
      await deleteAccount.execute({ userId, password });

      // When
      const loginResult = await loginWithPassword.execute({ email, password });

      // Then
      expect(loginResult.userId).toBe(userId);
      expect(loginResult.tokens.accessToken).toBeDefined();
      expect(loginResult.accountRestored).toBe(true);

      const restoredUser = await client.query.user.findFirst({ where: { id: userId } });
      expect(restoredUser?.deletedAt).toBeNull();
      expect(restoredUser?.status).toBe("ACTIVE");

      const logs = await client.query.securityLog.findMany({
        where: { userId, event: "ACCOUNT_RESTORED" },
      });
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it("유예 기간 초과 시 로그인 차단 (USER_0606)", async () => {
      // Given
      const pastDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

      const email = "expired-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);

      await client
        .update(userTable)
        .set({ deletedAt: pastDate, status: "SUSPENDED" })
        .where(eq(userTable.id, userId));

      // When
      await expect(loginWithPassword.execute({ email, password })).rejects.toThrow(DomainException);
    });
  });

  describe("PurgeDeletedAccounts — 계정 영구 삭제", () => {
    it("유예 기간 경과 후 hard delete 실행", async () => {
      // Given
      const pastDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

      const [created] = await client
        .insert(userTable)
        .values({
          email: "purge-test@example.com",
          userTag: "PURGE001",
          status: "SUSPENDED",
          deletedAt: pastDate,
        })
        .returning();
      const user = requireRecord(created);

      // When
      await purgeDeletedAccounts.execute();

      // Then
      const deletedUser = await client.query.user.findFirst({ where: { id: user.id } });
      expect(deletedUser).toBeUndefined();
    });

    it("유예 기간 내 사용자는 삭제하지 않음", async () => {
      // Given
      const recentDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS - 1);

      const [created] = await client
        .insert(userTable)
        .values({
          email: "keep-test@example.com",
          userTag: "KEEP0001",
          status: "SUSPENDED",
          deletedAt: recentDate,
        })
        .returning();
      const user = requireRecord(created);

      // When
      await purgeDeletedAccounts.execute();

      // Then
      const existingUser = await client.query.user.findFirst({ where: { id: user.id } });
      expect(existingUser).toBeDefined();
    });
  });

  describe("forgotPassword — 탈퇴 계정", () => {
    it("탈퇴 계정에 비밀번호 재설정 코드를 발송하지 않는다", async () => {
      // Given
      const email = "forgot-after-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);
      await deleteAccount.execute({ userId, password });

      // When
      const result = await requestPasswordReset.execute({ email });

      // Then
      expect(result.message).toBeDefined();

      const verifications = await client.query.verification.findMany({
        where: { userId, type: "PASSWORD_RESET" },
      });
      expect(verifications.length).toBe(0);
    });
  });
});

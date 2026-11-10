import { ACCOUNT_DELETION } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { vi } from "vitest";

import { AuthAccountRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import {
  AuthCachePort,
  AuthEmailSenderPort,
  AuthRegistrationNotifierPort,
} from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import {
  AuthPasswordHasherPort,
  AuthTokenIssuerPort,
} from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import { AuthLoginAttemptRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-login-attempt.repository.port";
import { AuthSecurityLogRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";
import { AuthSessionRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import { AuthUserRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import { AuthVerificationRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-verification.repository.port";
import { VerificationCodeSecurityPort } from "#api/modules/identity/auth/application/ports/verification-code-security.port";
import { LoginWithPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-password.use-case";
import { RegisterUseCase } from "#api/modules/identity/auth/application/use-cases/register.use-case";
import { RequestPasswordResetUseCase } from "#api/modules/identity/auth/application/use-cases/request-password-reset.use-case";
import { Argon2PasswordHasherAdapter } from "#api/modules/identity/auth/infrastructure/adapters/argon2-password-hasher.adapter";
import { AuthCacheAdapter } from "#api/modules/identity/auth/infrastructure/adapters/auth-cache.adapter";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/auth/infrastructure/adapters/jwt-token-issuer.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/node-verification-code-security.adapter";
import { DrizzleAccountRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-account.repository";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-login-attempt.repository";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-security-log.repository";
import { DrizzleSessionRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-session.repository";
import { DrizzleVerificationRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-verification.repository";
import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "#api/modules/identity/users/application/ports/account-cleanup.port";
import { DeleteAccountUseCase } from "#api/modules/identity/users/application/use-cases/delete-account.use-case";
import { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";
import { SendTransactionalEmailUseCase } from "#api/modules/notification/notification-email.public";
import { AdminEventNotifierPort } from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { DefaultTodoCategoryProvisionerAdapter } from "#api/modules/planning/categories/infrastructure/adapters/default-todo-category-provisioner.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { jwtConfig } from "#api/platform/config/jwt.config";
import { requireRecord } from "#api/platform/database/database-error.util";
import { DRIZZLE } from "#api/platform/database/database.client";
import { account, user as userTable } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { DateClock } from "#test/doubles/platform/date-clock";
import { NoCacheStore } from "#test/doubles/platform/no-cache-store";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  registerProvider,
  loginWithPasswordProvider,
  restoreAccountProvider,
  issueLoginProvider,
  requestPasswordResetProvider,
  provisionUserProvider,
  createSessionProvider,
  issueVerificationCodeProvider,
  sendVerificationCodeProvider,
  consumeVerificationCodeProvider,
} from "../../src/modules/identity/auth/identity-auth.providers.js";
import {
  deleteAccountProvider,
  purgeDeletedAccountsProvider,
} from "../../src/modules/identity/users/identity-users.providers.js";
import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase, type TestDatabaseClient } from "../setup/test-database.js";
import { provisioningSeederTestProvider } from "./helpers/provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./helpers/retention-enroller.provider.js";
import { sessionPushDeviceReleaserTestProvider } from "./helpers/session-push-device-releaser.provider.js";

function daysAgo(days: number): Temporal.Instant {
  return Temporal.Now.instant().subtract({ hours: days * 24 });
}

describe("회원 탈퇴 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let register: RegisterUseCase;
  let loginWithPassword: LoginWithPasswordUseCase;
  let requestPasswordReset: RequestPasswordResetUseCase;
  let deleteAccount: DeleteAccountUseCase;
  let purgeDeletedAccounts: PurgeDeletedAccountsUseCase;
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
          provide: AccountNotificationCleanupPort,
          useValue: {
            cleanupInTransaction: async () => ({ affectedUserIds: [] }),
            settleAfterCommit: async () => {},
          },
        },
        {
          provide: AccountUsageCleanupPort,
          useValue: { cleanupInTransaction: async () => undefined },
        },
        {
          provide: AccountTodoCommentCleanupPort,
          useValue: {
            cleanupInTransaction: async () => ({ affectedTodoIds: [] }),
            settleAfterCommit: async () => {},
          },
        },
        Argon2PasswordHasherAdapter,
        requestPasswordResetProvider,
        createSessionProvider,
        JwtTokenIssuerAdapter,
        issueVerificationCodeProvider,
        sendVerificationCodeProvider,
        consumeVerificationCodeProvider,
        {
          provide: VerificationCodeSecurityPort,
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
        { provide: AuthUserRepositoryPort, useExisting: DrizzleUserRepository },
        { provide: AuthAccountRepositoryPort, useExisting: DrizzleAccountRepository },
        { provide: AuthSessionRepositoryPort, useExisting: DrizzleSessionRepository },
        {
          provide: AuthVerificationRepositoryPort,
          useExisting: DrizzleVerificationRepository,
        },
        {
          provide: AuthLoginAttemptRepositoryPort,
          useExisting: DrizzleLoginAttemptRepository,
        },
        {
          provide: AuthSecurityLogRepositoryPort,
          useExisting: DrizzleSecurityLogRepository,
        },
        { provide: AuthPasswordHasherPort, useExisting: Argon2PasswordHasherAdapter },
        { provide: AuthTokenIssuerPort, useExisting: JwtTokenIssuerAdapter },
        { provide: AuthEmailSenderPort, useExisting: SendTransactionalEmailUseCase },
        AuthCacheAdapter,
        { provide: AuthCachePort, useExisting: AuthCacheAdapter },
        {
          provide: AuthRegistrationNotifierPort,
          useExisting: AdminEventNotifierPort,
        },
        DrizzleUserConsentRepository,
        DrizzleUserPreferenceRepository,
        DefaultTodoCategoryProvisionerAdapter,
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
        { provide: ClockPort, useClass: DateClock },
        { provide: OperationalAlertPort, useValue: new RecordingOperationalAlert() },
        {
          provide: jwtConfig.KEY,
          useValue: {
            secret: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
            refreshSecret:
              process.env.JWT_REFRESH_SECRET ?? "test-jwt-refresh-secret-for-integration",
            expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
            refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
          },
        },
        {
          provide: UnitOfWorkPort,
          useValue: transaction.uow,
        },
        {
          provide: SendTransactionalEmailUseCase,
          useClass: FakeEmailService,
        },
        {
          provide: CacheService,
          useValue: new CacheService(new NoCacheStore()),
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
          provide: AdminEventNotifierPort,
          useValue: {
            notifyUserRegistered: () => {},
            notifySubscriptionEvent: () => {},
          },
        },
        {
          provide: NotificationQueueAdapter,
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

    register = module.get(RegisterUseCase);
    loginWithPassword = module.get(LoginWithPasswordUseCase);
    requestPasswordReset = module.get(RequestPasswordResetUseCase);
    deleteAccount = module.get(DeleteAccountUseCase);
    purgeDeletedAccounts = module.get(PurgeDeletedAccountsUseCase);
  }, 60_000);

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
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    });

    await client
      .update(userTable)
      .set({
        status: "ACTIVE",
        emailVerifiedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      })
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
      expect(user?.deletedAt).toEqual(Temporal.Instant.from(result.deletedAt));
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
          emailVerifiedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        })
        .returning();
      const user = requireRecord(created);
      await client.insert(account).values({
        userId: user.id,
        provider: "GOOGLE",
        providerAccountId: "google-123",
        updatedAt: Temporal.Now.instant(),
      });

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
      const pastDate = daysAgo(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

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
      const pastDate = daysAgo(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

      const [created] = await client
        .insert(userTable)
        .values({
          email: "purge-test@example.com",
          userTag: "PURGE001",
          status: "SUSPENDED",
          deletedAt: pastDate,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
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
      const recentDate = daysAgo(ACCOUNT_DELETION.GRACE_PERIOD_DAYS - 1);

      const [created] = await client
        .insert(userTable)
        .values({
          email: "keep-test@example.com",
          userTag: "KEEP0001",
          status: "SUSPENDED",
          deletedAt: recentDate,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
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

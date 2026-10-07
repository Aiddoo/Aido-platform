import { ACCOUNT_DELETION } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
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
import { PurgeDeletedAccounts } from "#api/modules/identity/application/use-cases/auth/purge-deleted-accounts.use-case";
import { CredentialAuthWorkflow } from "#api/modules/identity/application/workflows/auth/credential-auth.workflow";
import { PasswordWorkflow } from "#api/modules/identity/application/workflows/auth/password.workflow";
import { AuthCacheAdapter } from "#api/modules/identity/infrastructure/adapters/auth/auth-cache.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/infrastructure/adapters/auth/node-verification-code-security.adapter";
import { PasswordService } from "#api/modules/identity/infrastructure/adapters/auth/password.service";
import { TokenService } from "#api/modules/identity/infrastructure/adapters/auth/token.service";
import { AccountRepository } from "#api/modules/identity/infrastructure/persistence/auth/account.repository";
import { LoginAttemptRepository } from "#api/modules/identity/infrastructure/persistence/auth/login-attempt.repository";
import { SecurityLogRepository } from "#api/modules/identity/infrastructure/persistence/auth/security-log.repository";
import { SessionRepository } from "#api/modules/identity/infrastructure/persistence/auth/session.repository";
import { UserRepository } from "#api/modules/identity/infrastructure/persistence/auth/user.repository";
import { VerificationRepository } from "#api/modules/identity/infrastructure/persistence/auth/verification.repository";
import { UserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-consent.repository";
import { UserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-preference.repository";
import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { DefaultTodoCategorySeeder } from "#api/modules/planning/infrastructure/seeders/categories/default-todo-category.seeder";
import { CacheService } from "#api/platform/cache/cache.service";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { DatabaseService } from "#api/platform/database/database.service";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { EncryptionService } from "#api/platform/encryption/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import {
  createDatabaseTransactionFixture,
  createTestDatabaseService,
} from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  credentialAuthWorkflowProvider,
  deleteAccountProvider,
  purgeDeletedAccountsProvider,
  restoreAccountProvider,
  issueLoginProvider,
  passwordWorkflowProvider,
  provisionUserProvider,
  sessionServiceProvider,
  verificationServiceProvider,
} from "../../src/modules/identity/identity-auth-application.providers.js";
import { FakeEmailService } from "../mocks/fake-email.service.js";
import { TestDatabase } from "../setup/test-database.js";
import { provisioningSeederTestProvider } from "./helpers/provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./helpers/retention-enroller.provider.js";

describe("회원 탈퇴 통합 테스트 (실제 DB)", () => {
  let module: TestingModule;
  let authService: CredentialAuthWorkflow;
  let passwordManagementService: PasswordWorkflow;
  let deleteAccount: DeleteAccount;
  let purgeDeletedAccounts: PurgeDeletedAccounts;
  let testDb: TestDatabase;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    testDb = new TestDatabase();
    databaseService = createTestDatabaseService(await testDb.start());

    const transaction = createDatabaseTransactionFixture(databaseService.db);
    module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [
        credentialAuthWorkflowProvider,
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
        passwordWorkflowProvider,
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
        AccountRepository,
        UserRepository,
        SessionRepository,
        SecurityLogRepository,
        LoginAttemptRepository,
        VerificationRepository,
        { provide: AUTH_USER_REPOSITORY, useExisting: UserRepository },
        { provide: AUTH_ACCOUNT_REPOSITORY, useExisting: AccountRepository },
        { provide: AUTH_SESSION_REPOSITORY, useExisting: SessionRepository },
        {
          provide: AUTH_VERIFICATION_REPOSITORY,
          useExisting: VerificationRepository,
        },
        {
          provide: AUTH_LOGIN_ATTEMPT_REPOSITORY,
          useExisting: LoginAttemptRepository,
        },
        {
          provide: AUTH_SECURITY_LOG_REPOSITORY,
          useExisting: SecurityLogRepository,
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
        UserConsentRepository,
        UserPreferenceRepository,
        DefaultTodoCategorySeeder,
        provisioningSeederTestProvider,
        retentionEnrollerTestProvider,
        {
          provide: DatabaseService,
          useValue: databaseService,
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
            cache.wrap.mockImplementation((_key, factory) => factory());
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

    authService = module.get<CredentialAuthWorkflow>(CredentialAuthWorkflow);
    passwordManagementService = module.get<PasswordWorkflow>(PasswordWorkflow);
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
      if (module) await module.close();
    } finally {
      if (testDb) await testDb.stop();
    }
  });

  /**
   * 테스트용 이메일 계정 생성 + 인증 완료 헬퍼
   * @returns userId
   */
  async function createVerifiedCredentialUser(email: string, password: string): Promise<string> {
    // 1. 회원가입
    const registerResult = await authService.register({
      email,
      password,
      passwordConfirm: password,
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    });

    // 2. DB에서 직접 인증 완료 처리
    const prisma = testDb.getClient();
    decodeRecord(
      "User",
      requireRecord(
        await prisma.orm.public.User.where((row) => row.id.eq(registerResult.userId)).update(
          encodePatch("User", {
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          }),
        ),
      ),
    );

    return registerResult.userId;
  }

  describe("deleteAccount", () => {
    it("CREDENTIAL 계정: soft delete + 세션 폐기 + 보안 로그 기록", async () => {
      // Given
      const email = "delete-test@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);

      // 로그인하여 세션 생성
      await authService.login({ email, password });

      // When
      const result = await deleteAccount.execute({ userId, password });

      // Then
      expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
      expect(result.deletedAt).toBeDefined();

      // DB 검증: user.deletedAt 설정됨
      const prisma = testDb.getClient();
      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.id.eq(userId)).first(),
      );
      expect(user?.deletedAt?.toISOString()).toBe(result.deletedAt);
      expect(user?.status).toBe("SUSPENDED");

      // DB 검증: 세션이 폐기됨
      const sessions = decodeRecord(
        "Session",
        await prisma.orm.public.Session.where((row) => row.userId.eq(userId)).all(),
      );
      for (const session of sessions) {
        expect(session.revokedAt).not.toBeNull();
      }

      // DB 검증: 보안 로그 기록됨
      const logs = decodeRecord(
        "SecurityLog",
        await prisma.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(userId), row.event.eq("ACCOUNT_DELETION_REQUESTED")),
        ).all(),
      );
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it("소셜 전용 계정: 비밀번호 없이 탈퇴 처리", async () => {
      // Given - DB에 직접 소셜 사용자 생성
      const prisma = testDb.getClient();
      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.create(
          encodeCreate("User", {
            email: "social-delete@example.com",
            userTag: "SODEL001",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          }),
        ),
      );
      decodeRecord(
        "Account",
        await prisma.orm.public.Account.create(
          encodeCreate("Account", {
            userId: user.id,
            provider: "GOOGLE",
            providerAccountId: "google-123",
          }),
        ),
      );

      // When
      const result = await deleteAccount.execute({ userId: user.id });

      // Then
      expect(result.gracePeriodDays).toBe(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
      const deletedUser = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.id.eq(user.id)).first(),
      );
      expect(deletedUser?.deletedAt).not.toBeNull();
    });

    it("유예 기간 내 credential 로그인 시 자동 복구", async () => {
      // Given - 탈퇴된 사용자
      const email = "login-after-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);
      await deleteAccount.execute({ userId, password });

      // When - 로그인 (탈퇴 직후 = 유예 기간 내)
      const loginResult = await authService.login({ email, password });

      // Then - 성공
      expect(loginResult.userId).toBe(userId);
      expect(loginResult.tokens.accessToken).toBeDefined();
      expect(loginResult.accountRestored).toBe(true);

      // DB 검증: 복구됨
      const prisma = testDb.getClient();
      const restoredUser = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.id.eq(userId)).first(),
      );
      expect(restoredUser?.deletedAt).toBeNull();
      expect(restoredUser?.status).toBe("ACTIVE");

      // 보안 로그: ACCOUNT_RESTORED 기록됨
      const logs = decodeRecord(
        "SecurityLog",
        await prisma.orm.public.SecurityLog.where((row) =>
          and(row.userId.eq(userId), row.event.eq("ACCOUNT_RESTORED")),
        ).all(),
      );
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it("유예 기간 초과 시 로그인 차단 (USER_0606)", async () => {
      // Given - 31일 전 탈퇴된 사용자 (DB 직접 생성)
      const prisma = testDb.getClient();
      const pastDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

      const email = "expired-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);

      // DB에서 직접 탈퇴 처리 (유예 기간 초과)
      decodeRecord(
        "User",
        requireRecord(
          await prisma.orm.public.User.where((row) => row.id.eq(userId)).update(
            encodePatch("User", { deletedAt: pastDate, status: "SUSPENDED" }),
          ),
        ),
      );

      // When & Then (탈퇴 복구 유예 초과 — 도메인 정책 USER_0606)
      await expect(authService.login({ email, password })).rejects.toThrow(DomainException);
    });
  });

  describe("PurgeDeletedAccounts — 계정 영구 삭제", () => {
    it("유예 기간 경과 후 hard delete 실행", async () => {
      // Given - deletedAt이 31일 전인 사용자 DB에 직접 생성
      const prisma = testDb.getClient();
      const pastDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1);

      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.create(
          encodeCreate("User", {
            email: "purge-test@example.com",
            userTag: "PURGE001",
            status: "SUSPENDED",
            deletedAt: pastDate,
          }),
        ),
      );

      // When
      await purgeDeletedAccounts.execute();

      // Then - user가 DB에서 완전 삭제됨
      const deletedUser = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.id.eq(user.id)).first(),
      );
      expect(deletedUser).toBeNull();
    });

    it("유예 기간 내 사용자는 삭제하지 않음", async () => {
      // Given - deletedAt이 29일 전인 사용자
      const prisma = testDb.getClient();
      const recentDate = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS - 1);

      const user = decodeRecord(
        "User",
        await prisma.orm.public.User.create(
          encodeCreate("User", {
            email: "keep-test@example.com",
            userTag: "KEEP0001",
            status: "SUSPENDED",
            deletedAt: recentDate,
          }),
        ),
      );

      // When
      await purgeDeletedAccounts.execute();

      // Then - user가 여전히 DB에 존재
      const existingUser = decodeRecord(
        "User",
        await prisma.orm.public.User.where((row) => row.id.eq(user.id)).first(),
      );
      expect(existingUser).not.toBeNull();
    });
  });

  describe("forgotPassword — 탈퇴 계정", () => {
    it("탈퇴 계정에 비밀번호 재설정 코드를 발송하지 않는다", async () => {
      // Given - soft deleted 사용자
      const email = "forgot-after-delete@example.com";
      const password = "Test1234!";
      const userId = await createVerifiedCredentialUser(email, password);
      await deleteAccount.execute({ userId, password });

      // When
      const result = await passwordManagementService.forgotPassword(email);

      // Then - 동일 응답 반환 (보안상)
      expect(result.message).toBeDefined();

      // verification 레코드 미생성 확인
      const prisma = testDb.getClient();
      const verifications = decodeRecord(
        "Verification",
        await prisma.orm.public.Verification.where((row) =>
          and(row.userId.eq(userId), row._type.eq("PASSWORD_RESET")),
        ).all(),
      );
      expect(verifications.length).toBe(0);
    });
  });
});

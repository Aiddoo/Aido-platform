import { TransactionHost } from "@nestjs-cls/transactional";
/**
 * Auth 통합 테스트 모듈 팩토리
 *
 * @description
 * auth-password-setup, auth-password-change, auth-password-reset 통합 테스트에서
 * 반복되는 TestingModule 설정을 통합합니다.
 *
 * 실제 DB (Testcontainers)를 사용하는 통합 테스트용입니다.
 */
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

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
import { DatabaseService } from "#api/platform/database/database.service";
import { EncryptionService } from "#api/platform/encryption/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";

import {
  credentialAuthWorkflowProvider,
  issueLoginProvider,
  passwordWorkflowProvider,
  provisionUserProvider,
  sessionServiceProvider,
  verificationServiceProvider,
} from "../../../src/modules/identity/identity-auth-application.providers.js";
import type { FakeEmailService } from "../../mocks/fake-email.service.js";
import { provisioningSeederTestProvider } from "./provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./retention-enroller.provider.js";

export async function createAuthTestModule(
  databaseService: DatabaseService,
  fakeEmailService: FakeEmailService,
): Promise<TestingModule> {
  const transaction = createDatabaseTransactionFixture(databaseService.db);
  return Test.createTestingModule({
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
      { provide: AUTH_CACHE, useExisting: CacheService },
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
        useValue: fakeEmailService,
      },
      {
        provide: CacheService,
        useValue: {
          invalidateSession: async () => {},
          invalidateUserProfile: async () => {},
          wrapUserProfile: async (_userId: string, fn: () => Promise<unknown>) => fn(),
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
          enqueueTodoAllCompleted: () => {},
          enqueueFriendCompleted: () => {},
        },
      },
    ],
  }).compile();
}

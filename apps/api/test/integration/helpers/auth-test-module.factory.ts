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

import { AdminEventNotifier } from "#api/admin-notification/index";
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
} from "#api/auth/application/ports/index";
import { VERIFICATION_CODE_SECURITY } from "#api/auth/application/ports/verification-code-security.port";
import { SessionService } from "#api/auth/application/services/session.service";
import { VerificationService } from "#api/auth/application/services/verification.service";
import { IssueLoginUseCase } from "#api/auth/application/use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "#api/auth/application/use-cases/provision-user/provision-user.use-case";
import { CredentialAuthWorkflow } from "#api/auth/application/workflows/credential-auth.workflow";
import { PasswordWorkflow } from "#api/auth/application/workflows/password.workflow";
import { NodeVerificationCodeSecurityAdapter } from "#api/auth/infrastructure/adapters/node-verification-code-security.adapter";
import { PasswordService } from "#api/auth/infrastructure/adapters/password.service";
import { TokenService } from "#api/auth/infrastructure/adapters/token.service";
import { AccountRepository } from "#api/auth/infrastructure/persistence/account.repository";
import { LoginAttemptRepository } from "#api/auth/infrastructure/persistence/login-attempt.repository";
import { SecurityLogRepository } from "#api/auth/infrastructure/persistence/security-log.repository";
import { SessionRepository } from "#api/auth/infrastructure/persistence/session.repository";
import { UserRepository } from "#api/auth/infrastructure/persistence/user.repository";
import { VerificationRepository } from "#api/auth/infrastructure/persistence/verification.repository";
import { TransactionalEmailSender } from "#api/email/index";
import { NotificationQueueService } from "#api/notification/queue";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { CacheService } from "#api/shared/infrastructure/cache/cache.service";
import { CACHE_SERVICE } from "#api/shared/infrastructure/cache/interfaces/cache.interface";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { EncryptionService } from "#api/shared/infrastructure/encryption/index";
import { DefaultTodoCategorySeeder } from "#api/todo-category/infrastructure/seeders/default-todo-category.seeder";
import { UserConsentRepository } from "#api/user-settings/infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "#api/user-settings/infrastructure/persistence/user-preference.repository";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";

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
      CredentialAuthWorkflow,
      IssueLoginUseCase,
      ProvisionUserUseCase,
      PasswordService,
      PasswordWorkflow,
      SessionService,
      TokenService,
      VerificationService,
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

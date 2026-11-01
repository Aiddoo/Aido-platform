import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_CACHE,
  AUTH_EMAIL_SENDER,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_OAUTH_STATE_REPOSITORY,
  AUTH_RUNTIME_CONFIG,
  AUTH_PASSWORD_HASHER,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_SESSION_REPOSITORY,
  AUTH_TOKEN_ISSUER,
  AUTH_USER_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
} from "#api/modules/identity/application/ports/auth/index";
import {
  OAUTH_IDENTITY_PROVIDER_REGISTRY,
  type OAuthIdentityProviderRegistry,
} from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { VERIFICATION_CODE_SECURITY } from "#api/modules/identity/application/ports/auth/verification-code-security.port";
import { AuthCacheAdapter } from "#api/modules/identity/infrastructure/adapters/auth/auth-cache.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/infrastructure/adapters/auth/node-verification-code-security.adapter";
import { PasswordService } from "#api/modules/identity/infrastructure/adapters/auth/password.service";
import { TokenService } from "#api/modules/identity/infrastructure/adapters/auth/token.service";
import { DrizzleAccountRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-account.repository";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-login-attempt.repository";
import { DrizzleOAuthStateRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-oauth-state.repository";
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
import { DRIZZLE } from "#api/platform/database/database.client";
import { EncryptionService } from "#api/platform/encryption/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import {
  createDatabaseTransactionFixture,
  type TestDatabaseClient,
} from "#test/setup/database-context";

import {
  completeOAuthAuthorizationProvider,
  exchangeOAuthCodeProvider,
  getOAuthRedirectUriProvider,
  linkOAuthAccountProvider,
  linkOAuthAccountWithCodeProvider,
  linkOAuthIdentityProvider,
  listLinkedAccountsProvider,
  loginWithOAuthTokenProvider,
  startOAuthAuthorizationProvider,
  unlinkOAuthAccountProvider,
  registerProvider,
  verifyEmailProvider,
  loginWithPasswordProvider,
  requestPasswordResetProvider,
  resetPasswordProvider,
  changePasswordProvider,
  requestPasswordSetupCodeProvider,
  setPasswordProvider,
  restoreAccountProvider,
  issueLoginProvider,
  provisionUserProvider,
  sessionServiceProvider,
  verificationServiceProvider,
} from "../../../src/modules/identity/identity-auth-application.providers.js";
import type { FakeEmailService } from "../../mocks/fake-email.service.js";
import { provisioningSeederTestProvider } from "./provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./retention-enroller.provider.js";

export async function createAuthTestModule(
  client: TestDatabaseClient,
  fakeEmailService: FakeEmailService,
  options: { readonly oauthProviderRegistry?: OAuthIdentityProviderRegistry } = {},
): Promise<TestingModule> {
  const transaction = createDatabaseTransactionFixture(client);
  return Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: "15m" },
      }),
    ],
    providers: [
      ...(options.oauthProviderRegistry === undefined
        ? []
        : [
            completeOAuthAuthorizationProvider,
            exchangeOAuthCodeProvider,
            getOAuthRedirectUriProvider,
            linkOAuthAccountProvider,
            linkOAuthAccountWithCodeProvider,
            linkOAuthIdentityProvider,
            listLinkedAccountsProvider,
            loginWithOAuthTokenProvider,
            startOAuthAuthorizationProvider,
            unlinkOAuthAccountProvider,
            DrizzleOAuthStateRepository,
            { provide: AUTH_OAUTH_STATE_REPOSITORY, useExisting: DrizzleOAuthStateRepository },
            { provide: AUTH_RUNTIME_CONFIG, useExisting: TypedConfigService },
            { provide: OAUTH_IDENTITY_PROVIDER_REGISTRY, useValue: options.oauthProviderRegistry },
          ]),
      registerProvider,
      verifyEmailProvider,
      loginWithPasswordProvider,
      requestPasswordResetProvider,
      resetPasswordProvider,
      changePasswordProvider,
      requestPasswordSetupCodeProvider,
      setPasswordProvider,
      restoreAccountProvider,
      issueLoginProvider,
      provisionUserProvider,
      PasswordService,
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
        useValue: fakeEmailService,
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
          isDevelopment: false,
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

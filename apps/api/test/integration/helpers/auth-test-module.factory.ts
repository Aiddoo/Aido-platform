import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import { AuthAccountRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import {
  AuthCachePort,
  AuthEmailSenderPort,
  AuthRuntimeConfigPort,
  AuthRegistrationNotifierPort,
} from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import {
  AuthPasswordHasherPort,
  AuthTokenIssuerPort,
} from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import { AuthLoginAttemptRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-login-attempt.repository.port";
import { AuthOAuthStateRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-oauth-state.repository.port";
import { AuthSecurityLogRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";
import { AuthSessionRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import { AuthUserRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import { AuthVerificationRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-verification.repository.port";
import { OAuthIdentityProviderRegistryPort } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { VerificationCodeSecurityPort } from "#api/modules/identity/auth/application/ports/verification-code-security.port";
import { Argon2PasswordHasherAdapter } from "#api/modules/identity/auth/infrastructure/adapters/argon2-password-hasher.adapter";
import { AuthCacheAdapter } from "#api/modules/identity/auth/infrastructure/adapters/auth-cache.adapter";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/auth/infrastructure/adapters/jwt-token-issuer.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/node-verification-code-security.adapter";
import { DrizzleAccountRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-account.repository";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-login-attempt.repository";
import { DrizzleOAuthStateRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-oauth-state.repository";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-security-log.repository";
import { DrizzleSessionRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-session.repository";
import { DrizzleUserRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-user.repository";
import { DrizzleVerificationRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-verification.repository";
import { DrizzleUserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/drizzle-user-preference.repository";
import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { DefaultTodoCategorySeeder } from "#api/modules/planning/infrastructure/seeders/categories/default-todo-category.seeder";
import { CacheService } from "#api/platform/cache/cache.service";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { jwtConfig } from "#api/platform/config/jwt.config";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DRIZZLE } from "#api/platform/database/database.client";
import { EncryptionService } from "#api/platform/encryption/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { DateNowClock } from "#test/doubles/platform/date-now-clock";
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
  loginWithMobileOAuthTokenProvider,
  loginWithOAuthTokenProvider,
  oauthSignupNotifierProvider,
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
  createSessionProvider,
  verificationServiceProvider,
} from "../../../src/modules/identity/auth/identity-auth.providers.js";
import type { FakeEmailService } from "../../mocks/fake-email.service.js";
import { provisioningSeederTestProvider } from "./provisioning-seeder.provider.js";
import { retentionEnrollerTestProvider } from "./retention-enroller.provider.js";
import { sessionPushDeviceReleaserTestProvider } from "./session-push-device-releaser.provider.js";

export async function createAuthTestModule(
  client: TestDatabaseClient,
  fakeEmailService: FakeEmailService,
  options: { readonly oauthProviderRegistry?: OAuthIdentityProviderRegistryPort } = {},
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
            loginWithMobileOAuthTokenProvider,
            loginWithOAuthTokenProvider,
            oauthSignupNotifierProvider,
            startOAuthAuthorizationProvider,
            unlinkOAuthAccountProvider,
            DrizzleOAuthStateRepository,
            { provide: AuthOAuthStateRepositoryPort, useExisting: DrizzleOAuthStateRepository },
            { provide: AuthRuntimeConfigPort, useExisting: TypedConfigService },
            { provide: OAuthIdentityProviderRegistryPort, useValue: options.oauthProviderRegistry },
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
      Argon2PasswordHasherAdapter,
      createSessionProvider,
      JwtTokenIssuerAdapter,
      verificationServiceProvider,
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
      { provide: AuthEmailSenderPort, useExisting: TransactionalEmailSender },
      AuthCacheAdapter,
      { provide: AuthCachePort, useExisting: AuthCacheAdapter },
      {
        provide: AuthRegistrationNotifierPort,
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
        provide: UnitOfWorkPort,
        useValue: transaction.uow,
      },
      { provide: ClockPort, useClass: DateNowClock },
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

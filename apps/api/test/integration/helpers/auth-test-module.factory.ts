import { TransactionHost } from "@nestjs-cls/transactional";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import { EntitlementCacheInvalidatorPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { EntitlementCacheAdapter } from "#api/modules/access/feature-grants/infrastructure/adapters/entitlement-cache.adapter";
import { LinkedAccountsRepositoryPort } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import { OAuthIdentityProviderRegistryPort } from "#api/modules/identity/linked-accounts/application/ports/oauth-identity-provider.port";
import { PasswordHasherPort } from "#api/modules/identity/linked-accounts/application/ports/password-hasher.port";
import { PasswordResetCooldownPort } from "#api/modules/identity/linked-accounts/application/ports/password-reset-cooldown.port";
import { Argon2PasswordHasherAdapter } from "#api/modules/identity/linked-accounts/infrastructure/adapters/argon2-password-hasher.adapter";
import { PasswordResetCooldownAdapter } from "#api/modules/identity/linked-accounts/infrastructure/adapters/password-reset-cooldown.adapter";
import { DrizzleLinkedAccountsRepository } from "#api/modules/identity/linked-accounts/infrastructure/persistence/drizzle-linked-accounts.repository";
import { OAuthRuntimeConfigPort } from "#api/modules/identity/oauth-states/application/ports/oauth-runtime-config.port";
import { OAuthStateRepositoryPort } from "#api/modules/identity/oauth-states/application/ports/oauth-state.repository.port";
import { DrizzleOAuthStateRepository } from "#api/modules/identity/oauth-states/infrastructure/persistence/drizzle-oauth-state.repository";
import { LoginAttemptRepositoryPort } from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";
import { SessionCachePort } from "#api/modules/identity/sessions/application/ports/session-cache.port";
import { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { TokenIssuerPort } from "#api/modules/identity/sessions/application/ports/token-issuer.port";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/sessions/infrastructure/adapters/jwt-token-issuer.adapter";
import { SessionCacheAdapter } from "#api/modules/identity/sessions/infrastructure/adapters/session-cache.adapter";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/sessions/infrastructure/persistence/drizzle-login-attempt.repository";
import { DrizzleSessionRepository } from "#api/modules/identity/sessions/infrastructure/persistence/drizzle-session.repository";
import { DrizzleUserConsentRepository } from "#api/modules/identity/user-preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/user-preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { SecurityLogRepositoryPort } from "#api/modules/identity/users/application/ports/security-log.repository.port";
import { UserMutationLockPort } from "#api/modules/identity/users/application/ports/user-mutation-lock.port";
import { UserProfileInvalidatorPort } from "#api/modules/identity/users/application/ports/user-profile-invalidator.port";
import { UserRegistrationNotifierPort } from "#api/modules/identity/users/application/ports/user-registration-notifier.port";
import { UserRepositoryPort } from "#api/modules/identity/users/application/ports/user.repository.port";
import { UserMutationLockAdapter } from "#api/modules/identity/users/infrastructure/adapters/user-mutation-lock.adapter";
import { UserProfileCacheAdapter } from "#api/modules/identity/users/infrastructure/adapters/user-profile-cache.adapter";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-security-log.repository";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { VerificationCodeEmailSenderPort } from "#api/modules/identity/verifications/application/ports/verification-code-email-sender.port";
import { VerificationCodeSecurityPort } from "#api/modules/identity/verifications/application/ports/verification-code-security.port";
import { VerificationEmailCapPort } from "#api/modules/identity/verifications/application/ports/verification-email-cap.port";
import { VerificationRepositoryPort } from "#api/modules/identity/verifications/application/ports/verification.repository.port";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/verifications/infrastructure/adapters/node-verification-code-security.adapter";
import { VerificationEmailCapAdapter } from "#api/modules/identity/verifications/infrastructure/adapters/verification-email-cap.adapter";
import { DrizzleVerificationRepository } from "#api/modules/identity/verifications/infrastructure/persistence/drizzle-verification.repository";
import { NotificationQueueAdapter } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import { AdminEventNotifierPort } from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { DefaultTodoCategoryProvisionerAdapter } from "#api/modules/planning/todo-categories/infrastructure/adapters/default-todo-category-provisioner.adapter";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { jwtConfig } from "#api/platform/config/jwt.config";
import { DRIZZLE } from "#api/platform/database/database.client";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { DateClock } from "#test/doubles/platform/date-clock";
import { NoCacheStore } from "#test/doubles/platform/no-cache-store";
import {
  createDatabaseTransactionFixture,
  type TestDatabaseClient,
} from "#test/setup/database-context";

import {
  linkOAuthAccountProvider,
  linkOAuthIdentityProvider,
  listLinkedAccountsProvider,
  unlinkOAuthAccountProvider,
  requestPasswordResetProvider,
  resetPasswordProvider,
  changePasswordProvider,
  requestPasswordSetupCodeProvider,
  setPasswordProvider,
} from "../../../src/modules/identity/linked-accounts/identity-linked-accounts.providers.js";
import {
  completeOAuthAuthorizationProvider,
  exchangeOAuthCodeProvider,
  getOAuthRedirectUriProvider,
  linkOAuthAccountWithCodeProvider,
  startOAuthAuthorizationProvider,
} from "../../../src/modules/identity/oauth-states/identity-oauth-states.providers.js";
import {
  loginWithMobileOAuthTokenProvider,
  loginWithOAuthTokenProvider,
  verifyEmailProvider,
  loginWithPasswordProvider,
  issueLoginProvider,
  createSessionProvider,
} from "../../../src/modules/identity/sessions/identity-sessions.providers.js";
import {
  oauthSignupNotifierProvider,
  registerProvider,
  restoreAccountProvider,
  provisionUserProvider,
} from "../../../src/modules/identity/users/identity-users.providers.js";
import {
  issueVerificationCodeProvider,
  checkVerificationEmailCapProvider,
  recordVerificationEmailSentProvider,
  sendVerificationCodeProvider,
  consumeVerificationCodeProvider,
} from "../../../src/modules/identity/verifications/identity-verifications.providers.js";
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
            { provide: OAuthStateRepositoryPort, useExisting: DrizzleOAuthStateRepository },
            { provide: OAuthRuntimeConfigPort, useValue: { allowsDevRedirects: false } },
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
      issueVerificationCodeProvider,
      checkVerificationEmailCapProvider,
      recordVerificationEmailSentProvider,
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
      DrizzleLinkedAccountsRepository,
      DrizzleUserRepository,
      DrizzleSessionRepository,
      DrizzleSecurityLogRepository,
      DrizzleLoginAttemptRepository,
      DrizzleVerificationRepository,
      { provide: UserRepositoryPort, useExisting: DrizzleUserRepository },
      { provide: UserMutationLockPort, useClass: UserMutationLockAdapter },
      { provide: LinkedAccountsRepositoryPort, useExisting: DrizzleLinkedAccountsRepository },
      { provide: SessionRepositoryPort, useExisting: DrizzleSessionRepository },
      {
        provide: VerificationRepositoryPort,
        useExisting: DrizzleVerificationRepository,
      },
      {
        provide: LoginAttemptRepositoryPort,
        useExisting: DrizzleLoginAttemptRepository,
      },
      {
        provide: SecurityLogRepositoryPort,
        useExisting: DrizzleSecurityLogRepository,
      },
      { provide: PasswordHasherPort, useExisting: Argon2PasswordHasherAdapter },
      { provide: TokenIssuerPort, useExisting: JwtTokenIssuerAdapter },
      { provide: VerificationCodeEmailSenderPort, useValue: fakeEmailService },
      { provide: SessionCachePort, useClass: SessionCacheAdapter },
      { provide: UserProfileInvalidatorPort, useClass: UserProfileCacheAdapter },
      { provide: PasswordResetCooldownPort, useClass: PasswordResetCooldownAdapter },
      { provide: VerificationEmailCapPort, useClass: VerificationEmailCapAdapter },
      { provide: EntitlementCacheInvalidatorPort, useClass: EntitlementCacheAdapter },
      {
        provide: UserRegistrationNotifierPort,
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
        useValue: transaction.transactionHost,
      },
      {
        provide: UnitOfWorkPort,
        useValue: transaction.uow,
      },
      { provide: ClockPort, useClass: DateClock },
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
        provide: CacheStorePort,
        useValue: new NoCacheStore(),
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
          enqueueTodoAllCompleted: () => {},
          enqueueFriendCompleted: () => {},
        },
      },
    ],
  }).compile();
}

import type { FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";
import { PREMIUM_ACCESS_READER } from "#api/modules/billing/billing-subscriptions.public";
import { TODO_CATEGORY_COUNT_READER } from "#api/modules/planning/planning-categories.public";
import { CHEER_USAGE_READER } from "#api/modules/social/social-cheers.public";
import { FRIEND_COUNT_READER } from "#api/modules/social/social-friends.public";
import { NUDGE_USAGE_READER } from "#api/modules/social/social-nudges.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";

import {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "./application/ports/account-cleanup.port.js";
import {
  AuthEmailSenderPort,
  AuthCachePort,
  AuthRegistrationNotifierPort,
  AuthRuntimeConfigPort,
} from "./application/ports/auth-collaboration.port.js";
import {
  AuthTokenIssuerPort,
  AuthPasswordHasherPort,
} from "./application/ports/auth-crypto.port.js";
import {
  AuthSessionRepositoryPort,
  AuthVerificationRepositoryPort,
  AuthLoginAttemptRepositoryPort,
  AuthSecurityLogRepositoryPort,
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
  AuthOAuthStateRepositoryPort,
} from "./application/ports/auth-persistence.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { UserProvisioningSeederPort } from "./application/ports/user-provisioning-seeder.port.js";
import { VerificationCodeSecurityPort } from "./application/ports/verification-code-security.port.js";
import { AuthenticateSessionUseCase } from "./application/use-cases/authenticate-session.use-case.js";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case.js";
import { CompleteOAuthAuthorizationUseCase } from "./application/use-cases/complete-oauth-authorization.use-case.js";
import { CreateSessionUseCase } from "./application/use-cases/create-session.use-case.js";
import { DeleteAccountUseCase } from "./application/use-cases/delete-account.use-case.js";
import { ExchangeOAuthCodeUseCase } from "./application/use-cases/exchange-oauth-code.use-case.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case.js";
import { GetEntitlementSnapshotUseCase } from "./application/use-cases/get-entitlement-snapshot.use-case.js";
import { GetOAuthRedirectUriUseCase } from "./application/use-cases/get-oauth-redirect-uri.use-case.js";
import { IssueLoginUseCase } from "./application/use-cases/issue-login.use-case.js";
import { VerificationService } from "./application/use-cases/issue-verification-code.use-case.js";
import { LinkOAuthAccountWithCodeUseCase } from "./application/use-cases/link-oauth-account-with-code.use-case.js";
import { LinkOAuthAccountUseCase } from "./application/use-cases/link-oauth-account.use-case.js";
import { LinkOAuthIdentityUseCase } from "./application/use-cases/link-oauth-identity.use-case.js";
import { ListActiveSessionsUseCase } from "./application/use-cases/list-active-sessions.use-case.js";
import { ListLinkedAccountsUseCase } from "./application/use-cases/list-linked-accounts.use-case.js";
import { LoginWithMobileOAuthTokenUseCase } from "./application/use-cases/login-with-mobile-oauth-token.use-case.js";
import { LoginWithOAuthTokenUseCase } from "./application/use-cases/login-with-oauth-token.use-case.js";
import { LoginWithPasswordUseCase } from "./application/use-cases/login-with-password.use-case.js";
import { LogoutAllUseCase } from "./application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { NotifyOAuthSignupUseCase } from "./application/use-cases/notify-oauth-signup.use-case.js";
import { ProvisionUserUseCase } from "./application/use-cases/provision-user.use-case.js";
import { PurgeDeletedAccountsUseCase } from "./application/use-cases/purge-deleted-accounts.use-case.js";
import { RefreshTokensUseCase } from "./application/use-cases/refresh-tokens.use-case.js";
import { RegisterUseCase } from "./application/use-cases/register.use-case.js";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case.js";
import { RequestPasswordSetupCodeUseCase } from "./application/use-cases/request-password-setup-code.use-case.js";
import { ResendVerificationUseCase } from "./application/use-cases/resend-verification.use-case.js";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case.js";
import { RestoreAccountUseCase } from "./application/use-cases/restore-account.use-case.js";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case.js";
import { SetPasswordUseCase } from "./application/use-cases/set-password.use-case.js";
import { StartOAuthAuthorizationUseCase } from "./application/use-cases/start-oauth-authorization.use-case.js";
import { UnlinkOAuthAccountUseCase } from "./application/use-cases/unlink-oauth-account.use-case.js";
import { UpdateProfileUseCase } from "./application/use-cases/update-profile.use-case.js";
import { VerifyEmailUseCase } from "./application/use-cases/verify-email.use-case.js";

// 아직 Symbol 토큰인 다른 Context 포트(billing·access·social)를 받아 provideUseCase 대신 factory로 조립한다
type GetCurrentUserDependencies = ConstructorParameters<typeof GetCurrentUserUseCase>[0];
export const getCurrentUserProvider: FactoryProvider<GetCurrentUserUseCase> = {
  provide: GetCurrentUserUseCase,
  inject: [
    AuthUserRepositoryPort,
    AuthCachePort,
    PREMIUM_ACCESS_READER,
    ENTITLEMENT_READER,
    QUOTA_LEDGER,
    CHEER_USAGE_READER,
    NUDGE_USAGE_READER,
  ],
  useFactory: (
    userRepository: GetCurrentUserDependencies["userRepository"],
    cacheService: GetCurrentUserDependencies["cacheService"],
    premiumAccessReader: GetCurrentUserDependencies["premiumAccessReader"],
    entitlementReader: GetCurrentUserDependencies["entitlementReader"],
    quotaLedger: GetCurrentUserDependencies["quotaLedger"],
    cheerUsageReader: GetCurrentUserDependencies["cheerUsageReader"],
    nudgeUsageReader: GetCurrentUserDependencies["nudgeUsageReader"],
  ) =>
    new GetCurrentUserUseCase({
      userRepository,
      cacheService,
      premiumAccessReader,
      entitlementReader,
      quotaLedger,
      cheerUsageReader,
      nudgeUsageReader,
    }),
};

type GetEntitlementSnapshotDependencies = ConstructorParameters<
  typeof GetEntitlementSnapshotUseCase
>[0];
export const getEntitlementSnapshotProvider: FactoryProvider<GetEntitlementSnapshotUseCase> = {
  provide: GetEntitlementSnapshotUseCase,
  inject: [
    QUOTA_LEDGER,
    CHEER_USAGE_READER,
    NUDGE_USAGE_READER,
    FRIEND_COUNT_READER,
    TODO_CATEGORY_COUNT_READER,
  ],
  useFactory: (
    quotaLedger: GetEntitlementSnapshotDependencies["quotaLedger"],
    cheerUsageReader: GetEntitlementSnapshotDependencies["cheerUsageReader"],
    nudgeUsageReader: GetEntitlementSnapshotDependencies["nudgeUsageReader"],
    friendCountReader: GetEntitlementSnapshotDependencies["friendCountReader"],
    categoryCountReader: GetEntitlementSnapshotDependencies["categoryCountReader"],
  ) =>
    new GetEntitlementSnapshotUseCase({
      quotaLedger,
      cheerUsageReader,
      nudgeUsageReader,
      friendCountReader,
      categoryCountReader,
    }),
};

export const getOAuthRedirectUriProvider = provideUseCase(GetOAuthRedirectUriUseCase, {
  oauthStateRepository: AuthOAuthStateRepositoryPort,
});

export const listActiveSessionsProvider = provideUseCase(ListActiveSessionsUseCase, {
  sessionRepository: AuthSessionRepositoryPort,
});
export const listLinkedAccountsProvider = provideUseCase(ListLinkedAccountsUseCase, {
  accountRepository: AuthAccountRepositoryPort,
});

export const authenticateSessionProvider = provideUseCase(AuthenticateSessionUseCase, {
  sessionRepository: AuthSessionRepositoryPort,
  userRepository: AuthUserRepositoryPort,
  cache: AuthCachePort,
  clock: ClockPort,
  logger: loggerFor(AuthenticateSessionUseCase),
});

export const createSessionProvider = provideUseCase(CreateSessionUseCase, {
  sessionRepository: AuthSessionRepositoryPort,
  tokenService: AuthTokenIssuerPort,
  clock: ClockPort,
});

export const verificationServiceProvider = provideUseCase(VerificationService, {
  verificationRepository: AuthVerificationRepositoryPort,
  emailSender: AuthEmailSenderPort,
  verificationCodeSecurity: VerificationCodeSecurityPort,
  clock: ClockPort,
  logger: loggerFor(VerificationService),
});

export const changePasswordProvider = provideUseCase(ChangePasswordUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  sessionRepository: AuthSessionRepositoryPort,
  cacheService: AuthCachePort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(ChangePasswordUseCase),
});

export const completeOAuthAuthorizationProvider = provideUseCase(
  CompleteOAuthAuthorizationUseCase,
  {
    registry: OAuthIdentityProviderRegistryPort,
    oauthStateRepository: AuthOAuthStateRepositoryPort,
    loginWithOAuthToken: LoginWithOAuthTokenUseCase,
    logger: loggerFor(CompleteOAuthAuthorizationUseCase),
  },
);

export const deleteAccountProvider = provideUseCase(DeleteAccountUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  sessionRepository: AuthSessionRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: AuthCachePort,
  clock: ClockPort,
  logger: loggerFor(DeleteAccountUseCase),
});

export const restoreAccountProvider = provideUseCase(RestoreAccountUseCase, {
  userRepository: AuthUserRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
});

export const purgeDeletedAccountsProvider = provideUseCase(PurgeDeletedAccountsUseCase, {
  userRepository: AuthUserRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  notificationCleanup: AccountNotificationCleanupPort,
  todoCommentCleanup: AccountTodoCommentCleanupPort,
  usageCleanup: AccountUsageCleanupPort,
  clock: ClockPort,
  logger: loggerFor(PurgeDeletedAccountsUseCase),
});

export const exchangeOAuthCodeProvider = provideUseCase(ExchangeOAuthCodeUseCase, {
  oauthStateRepository: AuthOAuthStateRepositoryPort,
  oauthSignupNotifier: NotifyOAuthSignupUseCase,
  clock: ClockPort,
  logger: loggerFor(ExchangeOAuthCodeUseCase),
});

export const oauthSignupNotifierProvider = provideUseCase(NotifyOAuthSignupUseCase, {
  userRepository: AuthUserRepositoryPort,
  adminEventNotifier: AuthRegistrationNotifierPort,
  logger: loggerFor(NotifyOAuthSignupUseCase),
});

export const issueLoginProvider = provideUseCase(IssueLoginUseCase, {
  sessionService: CreateSessionUseCase,
  loginAttemptRepository: AuthLoginAttemptRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  userRepository: AuthUserRepositoryPort,
});

export const linkOAuthIdentityProvider = provideUseCase(LinkOAuthIdentityUseCase, {
  accountRepository: AuthAccountRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
});

export const linkOAuthAccountProvider = provideUseCase(LinkOAuthAccountUseCase, {
  userRepository: AuthUserRepositoryPort,
  registry: OAuthIdentityProviderRegistryPort,
  linkOAuthIdentity: LinkOAuthIdentityUseCase,
  unitOfWork: UnitOfWorkPort,
  cacheService: AuthCachePort,
  logger: loggerFor(LinkOAuthAccountUseCase),
});

export const linkOAuthAccountWithCodeProvider = provideUseCase(LinkOAuthAccountWithCodeUseCase, {
  userRepository: AuthUserRepositoryPort,
  oauthStateRepository: AuthOAuthStateRepositoryPort,
  linkOAuthIdentity: LinkOAuthIdentityUseCase,
  unitOfWork: UnitOfWorkPort,
  cacheService: AuthCachePort,
  clock: ClockPort,
  logger: loggerFor(LinkOAuthAccountWithCodeUseCase),
});

export const loginWithOAuthTokenProvider = provideUseCase(LoginWithOAuthTokenUseCase, {
  registry: OAuthIdentityProviderRegistryPort,
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  loginAttemptRepository: AuthLoginAttemptRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: AuthCachePort,
  issueLoginUseCase: IssueLoginUseCase,
  provisionUserUseCase: ProvisionUserUseCase,
  restoreAccount: RestoreAccountUseCase,
  clock: ClockPort,
  logger: loggerFor(LoginWithOAuthTokenUseCase),
});

export const loginWithMobileOAuthTokenProvider = provideUseCase(LoginWithMobileOAuthTokenUseCase, {
  loginWithOAuthToken: LoginWithOAuthTokenUseCase,
  oauthSignupNotifier: NotifyOAuthSignupUseCase,
});

export const loginWithPasswordProvider = provideUseCase(LoginWithPasswordUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  loginAttemptRepository: AuthLoginAttemptRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  issueLoginUseCase: IssueLoginUseCase,
  restoreAccount: RestoreAccountUseCase,
  cacheService: AuthCachePort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(LoginWithPasswordUseCase),
});

export const logoutProvider = provideUseCase(LogoutUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  logger: loggerFor(LogoutUseCase),
});
export const logoutAllProvider = provideUseCase(LogoutAllUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  logger: loggerFor(LogoutAllUseCase),
});
export const provisionUserProvider = provideUseCase(ProvisionUserUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  seeder: UserProvisioningSeederPort,
  retentionEnroller: RetentionEnrollerPort,
});

export const refreshTokensProvider = provideUseCase(RefreshTokensUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  tokenService: AuthTokenIssuerPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  clock: ClockPort,
  logger: loggerFor(RefreshTokensUseCase),
});
export const registerProvider = provideUseCase(RegisterUseCase, {
  userRepository: AuthUserRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  provisionUserUseCase: ProvisionUserUseCase,
  verificationService: VerificationService,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  adminEventNotifier: AuthRegistrationNotifierPort,
  logger: loggerFor(RegisterUseCase),
});

export const requestPasswordResetProvider = provideUseCase(RequestPasswordResetUseCase, {
  userRepository: AuthUserRepositoryPort,
  verificationService: VerificationService,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  logger: loggerFor(RequestPasswordResetUseCase),
});

export const requestPasswordSetupCodeProvider = provideUseCase(RequestPasswordSetupCodeUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  verificationService: VerificationService,
});

export const resendVerificationProvider = provideUseCase(ResendVerificationUseCase, {
  userRepository: AuthUserRepositoryPort,
  verificationService: VerificationService,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(ResendVerificationUseCase),
});

export const resetPasswordProvider = provideUseCase(ResetPasswordUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  verificationService: VerificationService,
  sessionRepository: AuthSessionRepositoryPort,
  cacheService: AuthCachePort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(ResetPasswordUseCase),
});

export const revokeSessionProvider = provideUseCase(RevokeSessionUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  logger: loggerFor(RevokeSessionUseCase),
});
export const setPasswordProvider = provideUseCase(SetPasswordUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  verificationService: VerificationService,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(SetPasswordUseCase),
});

export const startOAuthAuthorizationProvider = provideUseCase(StartOAuthAuthorizationUseCase, {
  registry: OAuthIdentityProviderRegistryPort,
  oauthStateRepository: AuthOAuthStateRepositoryPort,
  configService: AuthRuntimeConfigPort,
  logger: loggerFor(StartOAuthAuthorizationUseCase),
});

export const unlinkOAuthAccountProvider = provideUseCase(UnlinkOAuthAccountUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: AuthCachePort,
  logger: loggerFor(UnlinkOAuthAccountUseCase),
});

export const updateProfileProvider = provideUseCase(UpdateProfileUseCase, {
  userRepository: AuthUserRepositoryPort,
  cacheService: AuthCachePort,
  logger: loggerFor(UpdateProfileUseCase),
});

export const verifyEmailProvider = provideUseCase(VerifyEmailUseCase, {
  userRepository: AuthUserRepositoryPort,
  verificationService: VerificationService,
  retentionEnroller: RetentionEnrollerPort,
  sessionService: CreateSessionUseCase,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(VerifyEmailUseCase),
});

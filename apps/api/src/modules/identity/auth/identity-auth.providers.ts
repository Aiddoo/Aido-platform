import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";
import { PREMIUM_ACCESS_READER } from "#api/modules/billing/billing-subscriptions.public";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { TODO_CATEGORY_COUNT_READER } from "#api/modules/planning/planning-categories.public";
import { CHEER_USAGE_READER } from "#api/modules/social/social-cheers.public";
import { FRIEND_COUNT_READER } from "#api/modules/social/social-friends.public";
import { NUDGE_USAGE_READER } from "#api/modules/social/social-nudges.public";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import {
  ACCOUNT_NOTIFICATION_CLEANUP,
  ACCOUNT_TODO_COMMENT_CLEANUP,
  ACCOUNT_USAGE_CLEANUP,
} from "./application/ports/account-cleanup.port.js";
import {
  AUTH_EMAIL_SENDER,
  AUTH_CACHE,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_RUNTIME_CONFIG,
} from "./application/ports/auth-collaboration.port.js";
import { AUTH_TOKEN_ISSUER, AUTH_PASSWORD_HASHER } from "./application/ports/auth-crypto.port.js";
import {
  AUTH_SESSION_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_USER_REPOSITORY,
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_OAUTH_STATE_REPOSITORY,
} from "./application/ports/auth-persistence.port.js";
import { RETENTION_ENROLLER } from "./application/ports/retention-enroller.port.js";
import { SESSION_PUSH_DEVICE_RELEASER } from "./application/ports/session-push-device-releaser.port.js";
import { USER_PROVISIONING_SEEDER } from "./application/ports/user-provisioning-seeder.port.js";
import { VERIFICATION_CODE_SECURITY } from "./application/ports/verification-code-security.port.js";
import { AuthenticateSessionUseCase } from "./application/use-cases/authenticate-session.use-case.js";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case.js";
import { CompleteOAuthAuthorizationUseCase } from "./application/use-cases/complete-oauth-authorization.use-case.js";
import { SessionService } from "./application/use-cases/create-session.use-case.js";
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

export const getCurrentUserProvider: FactoryProvider<GetCurrentUserUseCase> = {
  provide: GetCurrentUserUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_CACHE,
    PREMIUM_ACCESS_READER,
    ENTITLEMENT_READER,
    QUOTA_LEDGER,
    CHEER_USAGE_READER,
    NUDGE_USAGE_READER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["userRepository"],
    cacheService: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["cacheService"],
    premiumAccessReader: ConstructorParameters<
      typeof GetCurrentUserUseCase
    >[0]["premiumAccessReader"],
    entitlementReader: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["entitlementReader"],
    quotaLedger: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["quotaLedger"],
    cheerUsageReader: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["cheerUsageReader"],
    nudgeUsageReader: ConstructorParameters<typeof GetCurrentUserUseCase>[0]["nudgeUsageReader"],
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
    quotaLedger: ConstructorParameters<typeof GetEntitlementSnapshotUseCase>[0]["quotaLedger"],
    cheerUsageReader: ConstructorParameters<
      typeof GetEntitlementSnapshotUseCase
    >[0]["cheerUsageReader"],
    nudgeUsageReader: ConstructorParameters<
      typeof GetEntitlementSnapshotUseCase
    >[0]["nudgeUsageReader"],
    friendCountReader: ConstructorParameters<
      typeof GetEntitlementSnapshotUseCase
    >[0]["friendCountReader"],
    categoryCountReader: ConstructorParameters<
      typeof GetEntitlementSnapshotUseCase
    >[0]["categoryCountReader"],
  ) =>
    new GetEntitlementSnapshotUseCase({
      quotaLedger,
      cheerUsageReader,
      nudgeUsageReader,
      friendCountReader,
      categoryCountReader,
    }),
};

export const getOAuthRedirectUriProvider: FactoryProvider<GetOAuthRedirectUriUseCase> = {
  provide: GetOAuthRedirectUriUseCase,
  inject: [AUTH_OAUTH_STATE_REPOSITORY],
  useFactory: (
    oauthStateRepository: ConstructorParameters<
      typeof GetOAuthRedirectUriUseCase
    >[0]["oauthStateRepository"],
  ) =>
    new GetOAuthRedirectUriUseCase({
      oauthStateRepository,
    }),
};

export const listActiveSessionsProvider: FactoryProvider<ListActiveSessionsUseCase> = {
  provide: ListActiveSessionsUseCase,
  inject: [AUTH_SESSION_REPOSITORY],
  useFactory: (
    sessionRepository: ConstructorParameters<
      typeof ListActiveSessionsUseCase
    >[0]["sessionRepository"],
  ) => new ListActiveSessionsUseCase({ sessionRepository }),
};
export const listLinkedAccountsProvider: FactoryProvider<ListLinkedAccountsUseCase> = {
  provide: ListLinkedAccountsUseCase,
  inject: [AUTH_ACCOUNT_REPOSITORY],
  useFactory: (
    accountRepository: ConstructorParameters<
      typeof ListLinkedAccountsUseCase
    >[0]["accountRepository"],
  ) =>
    new ListLinkedAccountsUseCase({
      accountRepository,
    }),
};

export const authenticateSessionProvider: FactoryProvider<AuthenticateSessionUseCase> = {
  provide: AuthenticateSessionUseCase,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_USER_REPOSITORY, SessionService, AUTH_CACHE],
  useFactory: (
    sessionRepository: ConstructorParameters<
      typeof AuthenticateSessionUseCase
    >[0]["sessionRepository"],
    userRepository: ConstructorParameters<typeof AuthenticateSessionUseCase>[0]["userRepository"],
    sessionValidator: SessionService,
    cache: ConstructorParameters<typeof AuthenticateSessionUseCase>[0]["cache"],
  ) =>
    new AuthenticateSessionUseCase({
      sessionRepository,
      userRepository,
      sessionValidator,
      cache,
      logger: new Logger(AuthenticateSessionUseCase.name),
    }),
};

export const sessionServiceProvider: FactoryProvider<SessionService> = {
  provide: SessionService,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_TOKEN_ISSUER],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof SessionService>[0]["sessionRepository"],
    tokenService: ConstructorParameters<typeof SessionService>[0]["tokenService"],
  ) => new SessionService({ sessionRepository, tokenService }),
};

export const verificationServiceProvider: FactoryProvider<VerificationService> = {
  provide: VerificationService,
  inject: [AUTH_VERIFICATION_REPOSITORY, AUTH_EMAIL_SENDER, VERIFICATION_CODE_SECURITY],
  useFactory: (
    verificationRepository: ConstructorParameters<
      typeof VerificationService
    >[0]["verificationRepository"],
    emailSender: ConstructorParameters<typeof VerificationService>[0]["emailSender"],
    verificationCodeSecurity: ConstructorParameters<
      typeof VerificationService
    >[0]["verificationCodeSecurity"],
  ) =>
    new VerificationService({
      verificationRepository,
      emailSender,
      verificationCodeSecurity,
      logger: new Logger(VerificationService.name),
    }),
};

export const changePasswordProvider: FactoryProvider<ChangePasswordUseCase> = {
  provide: ChangePasswordUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SESSION_REPOSITORY,
    AUTH_CACHE,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ChangePasswordUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ChangePasswordUseCase>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof ChangePasswordUseCase>[0]["passwordService"],
    sessionRepository: ConstructorParameters<typeof ChangePasswordUseCase>[0]["sessionRepository"],
    cacheService: ConstructorParameters<typeof ChangePasswordUseCase>[0]["cacheService"],
    securityLogRepository: ConstructorParameters<
      typeof ChangePasswordUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof ChangePasswordUseCase>[0]["unitOfWork"],
    pushDevices: ConstructorParameters<typeof ChangePasswordUseCase>[0]["pushDevices"],
  ) =>
    new ChangePasswordUseCase({
      pushDevices,
      userRepository,
      accountRepository,
      passwordService,
      sessionRepository,
      cacheService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(ChangePasswordUseCase.name),
    }),
};

export const completeOAuthAuthorizationProvider: FactoryProvider<CompleteOAuthAuthorizationUseCase> =
  {
    provide: CompleteOAuthAuthorizationUseCase,
    inject: [
      OAUTH_IDENTITY_PROVIDER_REGISTRY,
      AUTH_OAUTH_STATE_REPOSITORY,
      LoginWithOAuthTokenUseCase,
    ],
    useFactory: (
      registry: ConstructorParameters<typeof CompleteOAuthAuthorizationUseCase>[0]["registry"],
      oauthStateRepository: ConstructorParameters<
        typeof CompleteOAuthAuthorizationUseCase
      >[0]["oauthStateRepository"],
      loginWithOAuthToken: ConstructorParameters<
        typeof CompleteOAuthAuthorizationUseCase
      >[0]["loginWithOAuthToken"],
    ) =>
      new CompleteOAuthAuthorizationUseCase({
        registry,
        oauthStateRepository,
        loginWithOAuthToken,
        logger: new Logger(CompleteOAuthAuthorizationUseCase.name),
      }),
  };

export const deleteAccountProvider: FactoryProvider<DeleteAccountUseCase> = {
  provide: DeleteAccountUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SESSION_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_CACHE,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof DeleteAccountUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof DeleteAccountUseCase>[0]["accountRepository"],
    sessionRepository: ConstructorParameters<typeof DeleteAccountUseCase>[0]["sessionRepository"],
    passwordService: ConstructorParameters<typeof DeleteAccountUseCase>[0]["passwordService"],
    securityLogRepository: ConstructorParameters<
      typeof DeleteAccountUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof DeleteAccountUseCase>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof DeleteAccountUseCase>[0]["cacheService"],
    pushDevices: ConstructorParameters<typeof DeleteAccountUseCase>[0]["pushDevices"],
  ) =>
    new DeleteAccountUseCase({
      pushDevices,
      userRepository,
      accountRepository,
      sessionRepository,
      passwordService,
      securityLogRepository,
      unitOfWork,
      cacheService,
      logger: new Logger(DeleteAccountUseCase.name),
    }),
};

export const restoreAccountProvider: FactoryProvider<RestoreAccountUseCase> = {
  provide: RestoreAccountUseCase,
  inject: [AUTH_USER_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY],
  useFactory: (
    userRepository: ConstructorParameters<typeof RestoreAccountUseCase>[0]["userRepository"],
    securityLogRepository: ConstructorParameters<
      typeof RestoreAccountUseCase
    >[0]["securityLogRepository"],
  ) => new RestoreAccountUseCase({ userRepository, securityLogRepository }),
};

export const purgeDeletedAccountsProvider: FactoryProvider<PurgeDeletedAccountsUseCase> = {
  provide: PurgeDeletedAccountsUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_SECURITY_LOG_REPOSITORY,
    ACCOUNT_NOTIFICATION_CLEANUP,
    ACCOUNT_TODO_COMMENT_CLEANUP,
    ACCOUNT_USAGE_CLEANUP,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof PurgeDeletedAccountsUseCase>[0]["userRepository"],
    unitOfWork: ConstructorParameters<typeof PurgeDeletedAccountsUseCase>[0]["unitOfWork"],
    securityLogRepository: ConstructorParameters<
      typeof PurgeDeletedAccountsUseCase
    >[0]["securityLogRepository"],
    notificationCleanup: ConstructorParameters<
      typeof PurgeDeletedAccountsUseCase
    >[0]["notificationCleanup"],
    todoCommentCleanup: ConstructorParameters<
      typeof PurgeDeletedAccountsUseCase
    >[0]["todoCommentCleanup"],
    usageCleanup: ConstructorParameters<typeof PurgeDeletedAccountsUseCase>[0]["usageCleanup"],
  ) =>
    new PurgeDeletedAccountsUseCase({
      userRepository,
      unitOfWork,
      securityLogRepository,
      notificationCleanup,
      todoCommentCleanup,
      usageCleanup,
      logger: new Logger(PurgeDeletedAccountsUseCase.name),
    }),
};

export const exchangeOAuthCodeProvider: FactoryProvider<ExchangeOAuthCodeUseCase> = {
  provide: ExchangeOAuthCodeUseCase,
  inject: [AUTH_OAUTH_STATE_REPOSITORY, NotifyOAuthSignupUseCase],
  useFactory: (
    oauthStateRepository: ConstructorParameters<
      typeof ExchangeOAuthCodeUseCase
    >[0]["oauthStateRepository"],
    oauthSignupNotifier: ConstructorParameters<
      typeof ExchangeOAuthCodeUseCase
    >[0]["oauthSignupNotifier"],
  ) =>
    new ExchangeOAuthCodeUseCase({
      oauthStateRepository,
      oauthSignupNotifier,
      logger: new Logger(ExchangeOAuthCodeUseCase.name),
    }),
};

export const oauthSignupNotifierProvider: FactoryProvider<NotifyOAuthSignupUseCase> = {
  provide: NotifyOAuthSignupUseCase,
  inject: [AUTH_USER_REPOSITORY, AUTH_REGISTRATION_NOTIFIER],
  useFactory: (
    userRepository: ConstructorParameters<typeof NotifyOAuthSignupUseCase>[0]["userRepository"],
    adminEventNotifier: ConstructorParameters<
      typeof NotifyOAuthSignupUseCase
    >[0]["adminEventNotifier"],
  ) =>
    new NotifyOAuthSignupUseCase({
      userRepository,
      adminEventNotifier,
      logger: new Logger(NotifyOAuthSignupUseCase.name),
    }),
};

export const issueLoginProvider: FactoryProvider<IssueLoginUseCase> = {
  provide: IssueLoginUseCase,
  inject: [
    SessionService,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_USER_REPOSITORY,
  ],
  useFactory: (
    sessionService: ConstructorParameters<typeof IssueLoginUseCase>[0]["sessionService"],
    loginAttemptRepository: ConstructorParameters<
      typeof IssueLoginUseCase
    >[0]["loginAttemptRepository"],
    securityLogRepository: ConstructorParameters<
      typeof IssueLoginUseCase
    >[0]["securityLogRepository"],
    userRepository: ConstructorParameters<typeof IssueLoginUseCase>[0]["userRepository"],
  ) =>
    new IssueLoginUseCase({
      sessionService,
      loginAttemptRepository,
      securityLogRepository,
      userRepository,
    }),
};

export const linkOAuthIdentityProvider: FactoryProvider<LinkOAuthIdentityUseCase> = {
  provide: LinkOAuthIdentityUseCase,
  inject: [AUTH_ACCOUNT_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY],
  useFactory: (
    accountRepository: ConstructorParameters<
      typeof LinkOAuthIdentityUseCase
    >[0]["accountRepository"],
    securityLogRepository: ConstructorParameters<
      typeof LinkOAuthIdentityUseCase
    >[0]["securityLogRepository"],
  ) =>
    new LinkOAuthIdentityUseCase({
      accountRepository,
      securityLogRepository,
    }),
};

export const linkOAuthAccountProvider: FactoryProvider<LinkOAuthAccountUseCase> = {
  provide: LinkOAuthAccountUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    OAUTH_IDENTITY_PROVIDER_REGISTRY,
    LinkOAuthIdentityUseCase,
    UNIT_OF_WORK,
    AUTH_CACHE,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof LinkOAuthAccountUseCase>[0]["userRepository"],
    registry: ConstructorParameters<typeof LinkOAuthAccountUseCase>[0]["registry"],
    linkOAuthIdentity: ConstructorParameters<
      typeof LinkOAuthAccountUseCase
    >[0]["linkOAuthIdentity"],
    unitOfWork: ConstructorParameters<typeof LinkOAuthAccountUseCase>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof LinkOAuthAccountUseCase>[0]["cacheService"],
  ) =>
    new LinkOAuthAccountUseCase({
      userRepository,
      registry,
      linkOAuthIdentity,
      unitOfWork,
      cacheService,
      logger: new Logger(LinkOAuthAccountUseCase.name),
    }),
};

export const linkOAuthAccountWithCodeProvider: FactoryProvider<LinkOAuthAccountWithCodeUseCase> = {
  provide: LinkOAuthAccountWithCodeUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_OAUTH_STATE_REPOSITORY,
    LinkOAuthIdentityUseCase,
    UNIT_OF_WORK,
    AUTH_CACHE,
  ],
  useFactory: (
    userRepository: ConstructorParameters<
      typeof LinkOAuthAccountWithCodeUseCase
    >[0]["userRepository"],
    oauthStateRepository: ConstructorParameters<
      typeof LinkOAuthAccountWithCodeUseCase
    >[0]["oauthStateRepository"],
    linkOAuthIdentity: ConstructorParameters<
      typeof LinkOAuthAccountWithCodeUseCase
    >[0]["linkOAuthIdentity"],
    unitOfWork: ConstructorParameters<typeof LinkOAuthAccountWithCodeUseCase>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof LinkOAuthAccountWithCodeUseCase>[0]["cacheService"],
  ) =>
    new LinkOAuthAccountWithCodeUseCase({
      userRepository,
      oauthStateRepository,
      linkOAuthIdentity,
      unitOfWork,
      cacheService,
      logger: new Logger(LinkOAuthAccountWithCodeUseCase.name),
    }),
};

export const loginWithOAuthTokenProvider: FactoryProvider<LoginWithOAuthTokenUseCase> = {
  provide: LoginWithOAuthTokenUseCase,
  inject: [
    OAUTH_IDENTITY_PROVIDER_REGISTRY,
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_CACHE,
    IssueLoginUseCase,
    ProvisionUserUseCase,
    RestoreAccountUseCase,
  ],
  useFactory: (
    registry: ConstructorParameters<typeof LoginWithOAuthTokenUseCase>[0]["registry"],
    userRepository: ConstructorParameters<typeof LoginWithOAuthTokenUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<
      typeof LoginWithOAuthTokenUseCase
    >[0]["accountRepository"],
    securityLogRepository: ConstructorParameters<
      typeof LoginWithOAuthTokenUseCase
    >[0]["securityLogRepository"],
    loginAttemptRepository: ConstructorParameters<
      typeof LoginWithOAuthTokenUseCase
    >[0]["loginAttemptRepository"],
    unitOfWork: ConstructorParameters<typeof LoginWithOAuthTokenUseCase>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof LoginWithOAuthTokenUseCase>[0]["cacheService"],
    issueLoginUseCase: ConstructorParameters<
      typeof LoginWithOAuthTokenUseCase
    >[0]["issueLoginUseCase"],
    provisionUserUseCase: ConstructorParameters<
      typeof LoginWithOAuthTokenUseCase
    >[0]["provisionUserUseCase"],
    restoreAccount: ConstructorParameters<typeof LoginWithOAuthTokenUseCase>[0]["restoreAccount"],
  ) =>
    new LoginWithOAuthTokenUseCase({
      registry,
      userRepository,
      accountRepository,
      securityLogRepository,
      loginAttemptRepository,
      unitOfWork,
      cacheService,
      issueLoginUseCase,
      provisionUserUseCase,
      restoreAccount,
      logger: new Logger(LoginWithOAuthTokenUseCase.name),
    }),
};

export const loginWithMobileOAuthTokenProvider: FactoryProvider<LoginWithMobileOAuthTokenUseCase> =
  {
    provide: LoginWithMobileOAuthTokenUseCase,
    inject: [LoginWithOAuthTokenUseCase, NotifyOAuthSignupUseCase],
    useFactory: (
      loginWithOAuthToken: ConstructorParameters<
        typeof LoginWithMobileOAuthTokenUseCase
      >[0]["loginWithOAuthToken"],
      oauthSignupNotifier: ConstructorParameters<
        typeof LoginWithMobileOAuthTokenUseCase
      >[0]["oauthSignupNotifier"],
    ) => new LoginWithMobileOAuthTokenUseCase({ loginWithOAuthToken, oauthSignupNotifier }),
  };

export const loginWithPasswordProvider: FactoryProvider<LoginWithPasswordUseCase> = {
  provide: LoginWithPasswordUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SECURITY_LOG_REPOSITORY,
    IssueLoginUseCase,
    RestoreAccountUseCase,
    AUTH_CACHE,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof LoginWithPasswordUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<
      typeof LoginWithPasswordUseCase
    >[0]["accountRepository"],
    loginAttemptRepository: ConstructorParameters<
      typeof LoginWithPasswordUseCase
    >[0]["loginAttemptRepository"],
    passwordService: ConstructorParameters<typeof LoginWithPasswordUseCase>[0]["passwordService"],
    securityLogRepository: ConstructorParameters<
      typeof LoginWithPasswordUseCase
    >[0]["securityLogRepository"],
    issueLoginUseCase: ConstructorParameters<
      typeof LoginWithPasswordUseCase
    >[0]["issueLoginUseCase"],
    restoreAccount: ConstructorParameters<typeof LoginWithPasswordUseCase>[0]["restoreAccount"],
    cacheService: ConstructorParameters<typeof LoginWithPasswordUseCase>[0]["cacheService"],
    unitOfWork: ConstructorParameters<typeof LoginWithPasswordUseCase>[0]["unitOfWork"],
  ) =>
    new LoginWithPasswordUseCase({
      userRepository,
      accountRepository,
      loginAttemptRepository,
      passwordService,
      securityLogRepository,
      issueLoginUseCase,
      restoreAccount,
      cacheService,
      unitOfWork,
      logger: new Logger(LoginWithPasswordUseCase.name),
    }),
};

export const logoutProvider: FactoryProvider<LogoutUseCase> = {
  provide: LogoutUseCase,
  inject: [
    AUTH_SESSION_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_CACHE,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof LogoutUseCase>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<typeof LogoutUseCase>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof LogoutUseCase>[0]["cacheService"],
    pushDevices: ConstructorParameters<typeof LogoutUseCase>[0]["pushDevices"],
  ) =>
    new LogoutUseCase({
      pushDevices,
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(LogoutUseCase.name),
    }),
};
export const logoutAllProvider: FactoryProvider<LogoutAllUseCase> = {
  provide: LogoutAllUseCase,
  inject: [
    AUTH_SESSION_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_CACHE,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof LogoutAllUseCase>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<
      typeof LogoutAllUseCase
    >[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof LogoutAllUseCase>[0]["cacheService"],
    pushDevices: ConstructorParameters<typeof LogoutAllUseCase>[0]["pushDevices"],
  ) =>
    new LogoutAllUseCase({
      pushDevices,
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(LogoutAllUseCase.name),
    }),
};
export const provisionUserProvider: FactoryProvider<ProvisionUserUseCase> = {
  provide: ProvisionUserUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    USER_PROVISIONING_SEEDER,
    RETENTION_ENROLLER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ProvisionUserUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ProvisionUserUseCase>[0]["accountRepository"],
    seeder: ConstructorParameters<typeof ProvisionUserUseCase>[0]["seeder"],
    retentionEnroller: ConstructorParameters<typeof ProvisionUserUseCase>[0]["retentionEnroller"],
  ) =>
    new ProvisionUserUseCase({
      userRepository,
      accountRepository,
      seeder,
      retentionEnroller,
    }),
};

export const refreshTokensProvider: FactoryProvider<RefreshTokensUseCase> = {
  provide: RefreshTokensUseCase,
  inject: [
    AUTH_SESSION_REPOSITORY,
    AUTH_TOKEN_ISSUER,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_CACHE,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof RefreshTokensUseCase>[0]["sessionRepository"],
    tokenService: ConstructorParameters<typeof RefreshTokensUseCase>[0]["tokenService"],
    securityLogRepository: ConstructorParameters<
      typeof RefreshTokensUseCase
    >[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof RefreshTokensUseCase>[0]["cacheService"],
    pushDevices: ConstructorParameters<typeof RefreshTokensUseCase>[0]["pushDevices"],
  ) =>
    new RefreshTokensUseCase({
      pushDevices,
      sessionRepository,
      tokenService,
      securityLogRepository,
      cacheService,
      logger: new Logger(RefreshTokensUseCase.name),
    }),
};
export const registerProvider: FactoryProvider<RegisterUseCase> = {
  provide: RegisterUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    ProvisionUserUseCase,
    VerificationService,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_REGISTRATION_NOTIFIER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof RegisterUseCase>[0]["userRepository"],
    passwordService: ConstructorParameters<typeof RegisterUseCase>[0]["passwordService"],
    provisionUserUseCase: ConstructorParameters<typeof RegisterUseCase>[0]["provisionUserUseCase"],
    verificationService: ConstructorParameters<typeof RegisterUseCase>[0]["verificationService"],
    securityLogRepository: ConstructorParameters<
      typeof RegisterUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof RegisterUseCase>[0]["unitOfWork"],
    adminEventNotifier: ConstructorParameters<typeof RegisterUseCase>[0]["adminEventNotifier"],
  ) =>
    new RegisterUseCase({
      userRepository,
      passwordService,
      provisionUserUseCase,
      verificationService,
      securityLogRepository,
      unitOfWork,
      adminEventNotifier,
      logger: new Logger(RegisterUseCase.name),
    }),
};

export const requestPasswordResetProvider: FactoryProvider<RequestPasswordResetUseCase> = {
  provide: RequestPasswordResetUseCase,
  inject: [AUTH_USER_REPOSITORY, VerificationService, AUTH_SECURITY_LOG_REPOSITORY],
  useFactory: (
    userRepository: ConstructorParameters<typeof RequestPasswordResetUseCase>[0]["userRepository"],
    verificationService: ConstructorParameters<
      typeof RequestPasswordResetUseCase
    >[0]["verificationService"],
    securityLogRepository: ConstructorParameters<
      typeof RequestPasswordResetUseCase
    >[0]["securityLogRepository"],
  ) =>
    new RequestPasswordResetUseCase({
      userRepository,
      verificationService,
      securityLogRepository,
      logger: new Logger(RequestPasswordResetUseCase.name),
    }),
};

export const requestPasswordSetupCodeProvider: FactoryProvider<RequestPasswordSetupCodeUseCase> = {
  provide: RequestPasswordSetupCodeUseCase,
  inject: [AUTH_USER_REPOSITORY, AUTH_ACCOUNT_REPOSITORY, VerificationService],
  useFactory: (
    userRepository: ConstructorParameters<
      typeof RequestPasswordSetupCodeUseCase
    >[0]["userRepository"],
    accountRepository: ConstructorParameters<
      typeof RequestPasswordSetupCodeUseCase
    >[0]["accountRepository"],
    verificationService: ConstructorParameters<
      typeof RequestPasswordSetupCodeUseCase
    >[0]["verificationService"],
  ) =>
    new RequestPasswordSetupCodeUseCase({
      userRepository,
      accountRepository,
      verificationService,
    }),
};

export const resendVerificationProvider: FactoryProvider<ResendVerificationUseCase> = {
  provide: ResendVerificationUseCase,
  inject: [AUTH_USER_REPOSITORY, VerificationService, UNIT_OF_WORK],
  useFactory: (
    userRepository: ConstructorParameters<typeof ResendVerificationUseCase>[0]["userRepository"],
    verificationService: ConstructorParameters<
      typeof ResendVerificationUseCase
    >[0]["verificationService"],
    unitOfWork: ConstructorParameters<typeof ResendVerificationUseCase>[0]["unitOfWork"],
  ) =>
    new ResendVerificationUseCase({
      userRepository,
      verificationService,
      unitOfWork,
      logger: new Logger(ResendVerificationUseCase.name),
    }),
};

export const resetPasswordProvider: FactoryProvider<ResetPasswordUseCase> = {
  provide: ResetPasswordUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    VerificationService,
    AUTH_SESSION_REPOSITORY,
    AUTH_CACHE,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ResetPasswordUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ResetPasswordUseCase>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof ResetPasswordUseCase>[0]["passwordService"],
    verificationService: ConstructorParameters<
      typeof ResetPasswordUseCase
    >[0]["verificationService"],
    sessionRepository: ConstructorParameters<typeof ResetPasswordUseCase>[0]["sessionRepository"],
    cacheService: ConstructorParameters<typeof ResetPasswordUseCase>[0]["cacheService"],
    securityLogRepository: ConstructorParameters<
      typeof ResetPasswordUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof ResetPasswordUseCase>[0]["unitOfWork"],
    pushDevices: ConstructorParameters<typeof ResetPasswordUseCase>[0]["pushDevices"],
  ) =>
    new ResetPasswordUseCase({
      pushDevices,
      userRepository,
      accountRepository,
      passwordService,
      verificationService,
      sessionRepository,
      cacheService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(ResetPasswordUseCase.name),
    }),
};

export const revokeSessionProvider: FactoryProvider<RevokeSessionUseCase> = {
  provide: RevokeSessionUseCase,
  inject: [
    AUTH_SESSION_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_CACHE,
    SESSION_PUSH_DEVICE_RELEASER,
  ],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof RevokeSessionUseCase>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<
      typeof RevokeSessionUseCase
    >[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof RevokeSessionUseCase>[0]["cacheService"],
    pushDevices: ConstructorParameters<typeof RevokeSessionUseCase>[0]["pushDevices"],
  ) =>
    new RevokeSessionUseCase({
      pushDevices,
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(RevokeSessionUseCase.name),
    }),
};
export const setPasswordProvider: FactoryProvider<SetPasswordUseCase> = {
  provide: SetPasswordUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    VerificationService,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_CACHE,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof SetPasswordUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof SetPasswordUseCase>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof SetPasswordUseCase>[0]["passwordService"],
    verificationService: ConstructorParameters<typeof SetPasswordUseCase>[0]["verificationService"],
    securityLogRepository: ConstructorParameters<
      typeof SetPasswordUseCase
    >[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof SetPasswordUseCase>[0]["cacheService"],
    unitOfWork: ConstructorParameters<typeof SetPasswordUseCase>[0]["unitOfWork"],
  ) =>
    new SetPasswordUseCase({
      userRepository,
      accountRepository,
      passwordService,
      verificationService,
      securityLogRepository,
      cacheService,
      unitOfWork,
      logger: new Logger(SetPasswordUseCase.name),
    }),
};

export const startOAuthAuthorizationProvider: FactoryProvider<StartOAuthAuthorizationUseCase> = {
  provide: StartOAuthAuthorizationUseCase,
  inject: [OAUTH_IDENTITY_PROVIDER_REGISTRY, AUTH_OAUTH_STATE_REPOSITORY, AUTH_RUNTIME_CONFIG],
  useFactory: (
    registry: ConstructorParameters<typeof StartOAuthAuthorizationUseCase>[0]["registry"],
    oauthStateRepository: ConstructorParameters<
      typeof StartOAuthAuthorizationUseCase
    >[0]["oauthStateRepository"],
    configService: ConstructorParameters<typeof StartOAuthAuthorizationUseCase>[0]["configService"],
  ) =>
    new StartOAuthAuthorizationUseCase({
      registry,
      oauthStateRepository,
      configService,
      logger: new Logger(StartOAuthAuthorizationUseCase.name),
    }),
};

export const unlinkOAuthAccountProvider: FactoryProvider<UnlinkOAuthAccountUseCase> = {
  provide: UnlinkOAuthAccountUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_CACHE,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof UnlinkOAuthAccountUseCase>[0]["userRepository"],
    accountRepository: ConstructorParameters<
      typeof UnlinkOAuthAccountUseCase
    >[0]["accountRepository"],
    securityLogRepository: ConstructorParameters<
      typeof UnlinkOAuthAccountUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof UnlinkOAuthAccountUseCase>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof UnlinkOAuthAccountUseCase>[0]["cacheService"],
  ) =>
    new UnlinkOAuthAccountUseCase({
      userRepository,
      accountRepository,
      securityLogRepository,
      unitOfWork,
      cacheService,
      logger: new Logger(UnlinkOAuthAccountUseCase.name),
    }),
};

export const updateProfileProvider: FactoryProvider<UpdateProfileUseCase> = {
  provide: UpdateProfileUseCase,
  inject: [AUTH_USER_REPOSITORY, AUTH_CACHE],
  useFactory: (
    userRepository: ConstructorParameters<typeof UpdateProfileUseCase>[0]["userRepository"],
    cacheService: ConstructorParameters<typeof UpdateProfileUseCase>[0]["cacheService"],
  ) =>
    new UpdateProfileUseCase({
      userRepository,
      cacheService,
      logger: new Logger(UpdateProfileUseCase.name),
    }),
};

export const verifyEmailProvider: FactoryProvider<VerifyEmailUseCase> = {
  provide: VerifyEmailUseCase,
  inject: [
    AUTH_USER_REPOSITORY,
    VerificationService,
    RETENTION_ENROLLER,
    SessionService,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof VerifyEmailUseCase>[0]["userRepository"],
    verificationService: ConstructorParameters<typeof VerifyEmailUseCase>[0]["verificationService"],
    retentionEnroller: ConstructorParameters<typeof VerifyEmailUseCase>[0]["retentionEnroller"],
    sessionService: ConstructorParameters<typeof VerifyEmailUseCase>[0]["sessionService"],
    securityLogRepository: ConstructorParameters<
      typeof VerifyEmailUseCase
    >[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof VerifyEmailUseCase>[0]["unitOfWork"],
  ) =>
    new VerifyEmailUseCase({
      userRepository,
      verificationService,
      retentionEnroller,
      sessionService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(VerifyEmailUseCase.name),
    }),
};

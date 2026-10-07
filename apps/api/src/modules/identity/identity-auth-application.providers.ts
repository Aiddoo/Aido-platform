import { Logger, type FactoryProvider } from "@nestjs/common";

import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import {
  ACCOUNT_NOTIFICATION_CLEANUP,
  ACCOUNT_TODO_COMMENT_CLEANUP,
} from "./application/ports/auth/account-cleanup.port.js";
import {
  AUTH_EMAIL_SENDER,
  AUTH_CACHE,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_RUNTIME_CONFIG,
} from "./application/ports/auth/auth-collaboration.port.js";
import {
  AUTH_TOKEN_ISSUER,
  AUTH_PASSWORD_HASHER,
} from "./application/ports/auth/auth-crypto.port.js";
import {
  AUTH_SESSION_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_USER_REPOSITORY,
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_OAUTH_STATE_REPOSITORY,
} from "./application/ports/auth/auth-persistence.port.js";
import { RETENTION_ENROLLER } from "./application/ports/auth/retention-enroller.port.js";
import { USER_PROVISIONING_SEEDER } from "./application/ports/auth/user-provisioning-seeder.port.js";
import { VERIFICATION_CODE_SECURITY } from "./application/ports/auth/verification-code-security.port.js";
import { SessionService } from "./application/services/auth/session.service.js";
import { VerificationService } from "./application/services/auth/verification.service.js";
import { ChangePassword } from "./application/use-cases/auth/change-password.use-case.js";
import { CompleteOAuthAuthorization } from "./application/use-cases/auth/complete-oauth-authorization.use-case.js";
import { DeleteAccount } from "./application/use-cases/auth/delete-account.use-case.js";
import { ExchangeOAuthCode } from "./application/use-cases/auth/exchange-oauth-code.use-case.js";
import { GetCurrentUser } from "./application/use-cases/auth/get-current-user.use-case.js";
import { GetOAuthRedirectUri } from "./application/use-cases/auth/get-oauth-redirect-uri.use-case.js";
import { IssueLogin } from "./application/use-cases/auth/issue-login.use-case.js";
import { LinkOAuthAccountWithCode } from "./application/use-cases/auth/link-oauth-account-with-code.use-case.js";
import { LinkOAuthAccount } from "./application/use-cases/auth/link-oauth-account.use-case.js";
import { ListActiveSessions } from "./application/use-cases/auth/list-active-sessions.use-case.js";
import { ListLinkedAccounts } from "./application/use-cases/auth/list-linked-accounts.use-case.js";
import { LoginWithOAuthToken } from "./application/use-cases/auth/login-with-oauth-token.use-case.js";
import { LoginWithPassword } from "./application/use-cases/auth/login-with-password.use-case.js";
import { LogoutAll } from "./application/use-cases/auth/logout-all.use-case.js";
import { Logout } from "./application/use-cases/auth/logout.use-case.js";
import { ProvisionUser } from "./application/use-cases/auth/provision-user.use-case.js";
import { PurgeDeletedAccounts } from "./application/use-cases/auth/purge-deleted-accounts.use-case.js";
import { RefreshTokens } from "./application/use-cases/auth/refresh-tokens.use-case.js";
import { Register } from "./application/use-cases/auth/register.use-case.js";
import { RequestPasswordReset } from "./application/use-cases/auth/request-password-reset.use-case.js";
import { RequestPasswordSetupCode } from "./application/use-cases/auth/request-password-setup-code.use-case.js";
import { ResendVerification } from "./application/use-cases/auth/resend-verification.use-case.js";
import { ResetPassword } from "./application/use-cases/auth/reset-password.use-case.js";
import { RestoreAccount } from "./application/use-cases/auth/restore-account.use-case.js";
import { RevokeSession } from "./application/use-cases/auth/revoke-session.use-case.js";
import { SetPassword } from "./application/use-cases/auth/set-password.use-case.js";
import { StartOAuthAuthorization } from "./application/use-cases/auth/start-oauth-authorization.use-case.js";
import { UnlinkOAuthAccount } from "./application/use-cases/auth/unlink-oauth-account.use-case.js";
import { UpdateProfile } from "./application/use-cases/auth/update-profile.use-case.js";
import { VerifyEmail } from "./application/use-cases/auth/verify-email.use-case.js";
import { OAuthWorkflow } from "./application/workflows/auth/oauth.workflow.js";

export const getCurrentUserProvider: FactoryProvider<GetCurrentUser> = {
  provide: GetCurrentUser,
  inject: [AUTH_USER_REPOSITORY, AUTH_CACHE],
  useFactory: (
    userRepository: ConstructorParameters<typeof GetCurrentUser>[0]["userRepository"],
    cacheService: ConstructorParameters<typeof GetCurrentUser>[0]["cacheService"],
  ) =>
    new GetCurrentUser({
      userRepository,
      cacheService,
    }),
};

export const getOAuthRedirectUriProvider: FactoryProvider<GetOAuthRedirectUri> = {
  provide: GetOAuthRedirectUri,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof GetOAuthRedirectUri>[0]["workflow"]) =>
    new GetOAuthRedirectUri({ workflow }),
};

export const listActiveSessionsProvider: FactoryProvider<ListActiveSessions> = {
  provide: ListActiveSessions,
  inject: [AUTH_SESSION_REPOSITORY],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof ListActiveSessions>[0]["sessionRepository"],
  ) => new ListActiveSessions({ sessionRepository }),
};
export const listLinkedAccountsProvider: FactoryProvider<ListLinkedAccounts> = {
  provide: ListLinkedAccounts,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof ListLinkedAccounts>[0]["workflow"]) =>
    new ListLinkedAccounts({ workflow }),
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

export const changePasswordProvider: FactoryProvider<ChangePassword> = {
  provide: ChangePassword,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SESSION_REPOSITORY,
    AUTH_CACHE,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ChangePassword>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ChangePassword>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof ChangePassword>[0]["passwordService"],
    sessionRepository: ConstructorParameters<typeof ChangePassword>[0]["sessionRepository"],
    cacheService: ConstructorParameters<typeof ChangePassword>[0]["cacheService"],
    securityLogRepository: ConstructorParameters<typeof ChangePassword>[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof ChangePassword>[0]["unitOfWork"],
  ) =>
    new ChangePassword({
      userRepository,
      accountRepository,
      passwordService,
      sessionRepository,
      cacheService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(ChangePassword.name),
    }),
};

export const completeOAuthAuthorizationProvider: FactoryProvider<CompleteOAuthAuthorization> = {
  provide: CompleteOAuthAuthorization,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof CompleteOAuthAuthorization>[0]["workflow"]) =>
    new CompleteOAuthAuthorization({ workflow }),
};

export const deleteAccountProvider: FactoryProvider<DeleteAccount> = {
  provide: DeleteAccount,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SESSION_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_CACHE,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof DeleteAccount>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof DeleteAccount>[0]["accountRepository"],
    sessionRepository: ConstructorParameters<typeof DeleteAccount>[0]["sessionRepository"],
    passwordService: ConstructorParameters<typeof DeleteAccount>[0]["passwordService"],
    securityLogRepository: ConstructorParameters<typeof DeleteAccount>[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof DeleteAccount>[0]["unitOfWork"],
    cacheService: ConstructorParameters<typeof DeleteAccount>[0]["cacheService"],
  ) =>
    new DeleteAccount({
      userRepository,
      accountRepository,
      sessionRepository,
      passwordService,
      securityLogRepository,
      unitOfWork,
      cacheService,
      logger: new Logger(DeleteAccount.name),
    }),
};

export const restoreAccountProvider: FactoryProvider<RestoreAccount> = {
  provide: RestoreAccount,
  inject: [AUTH_USER_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY],
  useFactory: (
    userRepository: ConstructorParameters<typeof RestoreAccount>[0]["userRepository"],
    securityLogRepository: ConstructorParameters<typeof RestoreAccount>[0]["securityLogRepository"],
  ) => new RestoreAccount({ userRepository, securityLogRepository }),
};

export const purgeDeletedAccountsProvider: FactoryProvider<PurgeDeletedAccounts> = {
  provide: PurgeDeletedAccounts,
  inject: [
    AUTH_USER_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_SECURITY_LOG_REPOSITORY,
    ACCOUNT_NOTIFICATION_CLEANUP,
    ACCOUNT_TODO_COMMENT_CLEANUP,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof PurgeDeletedAccounts>[0]["userRepository"],
    unitOfWork: ConstructorParameters<typeof PurgeDeletedAccounts>[0]["unitOfWork"],
    securityLogRepository: ConstructorParameters<
      typeof PurgeDeletedAccounts
    >[0]["securityLogRepository"],
    notificationCleanup: ConstructorParameters<
      typeof PurgeDeletedAccounts
    >[0]["notificationCleanup"],
    todoCommentCleanup: ConstructorParameters<typeof PurgeDeletedAccounts>[0]["todoCommentCleanup"],
  ) =>
    new PurgeDeletedAccounts({
      userRepository,
      unitOfWork,
      securityLogRepository,
      notificationCleanup,
      todoCommentCleanup,
      logger: new Logger(PurgeDeletedAccounts.name),
    }),
};

export const exchangeOAuthCodeProvider: FactoryProvider<ExchangeOAuthCode> = {
  provide: ExchangeOAuthCode,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof ExchangeOAuthCode>[0]["workflow"]) =>
    new ExchangeOAuthCode({ workflow }),
};

export const issueLoginProvider: FactoryProvider<IssueLogin> = {
  provide: IssueLogin,
  inject: [
    SessionService,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_USER_REPOSITORY,
  ],
  useFactory: (
    sessionService: ConstructorParameters<typeof IssueLogin>[0]["sessionService"],
    loginAttemptRepository: ConstructorParameters<typeof IssueLogin>[0]["loginAttemptRepository"],
    securityLogRepository: ConstructorParameters<typeof IssueLogin>[0]["securityLogRepository"],
    userRepository: ConstructorParameters<typeof IssueLogin>[0]["userRepository"],
  ) =>
    new IssueLogin({
      sessionService,
      loginAttemptRepository,
      securityLogRepository,
      userRepository,
    }),
};

export const linkOAuthAccountProvider: FactoryProvider<LinkOAuthAccount> = {
  provide: LinkOAuthAccount,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof LinkOAuthAccount>[0]["workflow"]) =>
    new LinkOAuthAccount({ workflow }),
};

export const linkOAuthAccountWithCodeProvider: FactoryProvider<LinkOAuthAccountWithCode> = {
  provide: LinkOAuthAccountWithCode,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof LinkOAuthAccountWithCode>[0]["workflow"]) =>
    new LinkOAuthAccountWithCode({ workflow }),
};

export const loginWithOAuthTokenProvider: FactoryProvider<LoginWithOAuthToken> = {
  provide: LoginWithOAuthToken,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof LoginWithOAuthToken>[0]["workflow"]) =>
    new LoginWithOAuthToken({ workflow }),
};

export const loginWithPasswordProvider: FactoryProvider<LoginWithPassword> = {
  provide: LoginWithPassword,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    AUTH_SECURITY_LOG_REPOSITORY,
    IssueLogin,
    RestoreAccount,
    AUTH_CACHE,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof LoginWithPassword>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof LoginWithPassword>[0]["accountRepository"],
    loginAttemptRepository: ConstructorParameters<
      typeof LoginWithPassword
    >[0]["loginAttemptRepository"],
    passwordService: ConstructorParameters<typeof LoginWithPassword>[0]["passwordService"],
    securityLogRepository: ConstructorParameters<
      typeof LoginWithPassword
    >[0]["securityLogRepository"],
    issueLoginUseCase: ConstructorParameters<typeof LoginWithPassword>[0]["issueLoginUseCase"],
    restoreAccount: ConstructorParameters<typeof LoginWithPassword>[0]["restoreAccount"],
    cacheService: ConstructorParameters<typeof LoginWithPassword>[0]["cacheService"],
    unitOfWork: ConstructorParameters<typeof LoginWithPassword>[0]["unitOfWork"],
  ) =>
    new LoginWithPassword({
      userRepository,
      accountRepository,
      loginAttemptRepository,
      passwordService,
      securityLogRepository,
      issueLoginUseCase,
      restoreAccount,
      cacheService,
      unitOfWork,
      logger: new Logger(LoginWithPassword.name),
    }),
};

export const logoutProvider: FactoryProvider<Logout> = {
  provide: Logout,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY, AUTH_CACHE],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof Logout>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<typeof Logout>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof Logout>[0]["cacheService"],
  ) =>
    new Logout({
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(Logout.name),
    }),
};
export const logoutAllProvider: FactoryProvider<LogoutAll> = {
  provide: LogoutAll,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY, AUTH_CACHE],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof LogoutAll>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<typeof LogoutAll>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof LogoutAll>[0]["cacheService"],
  ) =>
    new LogoutAll({
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(LogoutAll.name),
    }),
};
export const provisionUserProvider: FactoryProvider<ProvisionUser> = {
  provide: ProvisionUser,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    USER_PROVISIONING_SEEDER,
    RETENTION_ENROLLER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ProvisionUser>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ProvisionUser>[0]["accountRepository"],
    seeder: ConstructorParameters<typeof ProvisionUser>[0]["seeder"],
    retentionEnroller: ConstructorParameters<typeof ProvisionUser>[0]["retentionEnroller"],
  ) =>
    new ProvisionUser({
      userRepository,
      accountRepository,
      seeder,
      retentionEnroller,
    }),
};

export const refreshTokensProvider: FactoryProvider<RefreshTokens> = {
  provide: RefreshTokens,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_TOKEN_ISSUER, AUTH_SECURITY_LOG_REPOSITORY, AUTH_CACHE],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof RefreshTokens>[0]["sessionRepository"],
    tokenService: ConstructorParameters<typeof RefreshTokens>[0]["tokenService"],
    securityLogRepository: ConstructorParameters<typeof RefreshTokens>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof RefreshTokens>[0]["cacheService"],
  ) =>
    new RefreshTokens({
      sessionRepository,
      tokenService,
      securityLogRepository,
      cacheService,
      logger: new Logger(RefreshTokens.name),
    }),
};
export const registerProvider: FactoryProvider<Register> = {
  provide: Register,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    ProvisionUser,
    VerificationService,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
    AUTH_REGISTRATION_NOTIFIER,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof Register>[0]["userRepository"],
    passwordService: ConstructorParameters<typeof Register>[0]["passwordService"],
    provisionUserUseCase: ConstructorParameters<typeof Register>[0]["provisionUserUseCase"],
    verificationService: ConstructorParameters<typeof Register>[0]["verificationService"],
    securityLogRepository: ConstructorParameters<typeof Register>[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof Register>[0]["unitOfWork"],
    adminEventNotifier: ConstructorParameters<typeof Register>[0]["adminEventNotifier"],
  ) =>
    new Register({
      userRepository,
      passwordService,
      provisionUserUseCase,
      verificationService,
      securityLogRepository,
      unitOfWork,
      adminEventNotifier,
      logger: new Logger(Register.name),
    }),
};

export const requestPasswordResetProvider: FactoryProvider<RequestPasswordReset> = {
  provide: RequestPasswordReset,
  inject: [AUTH_USER_REPOSITORY, VerificationService, AUTH_SECURITY_LOG_REPOSITORY],
  useFactory: (
    userRepository: ConstructorParameters<typeof RequestPasswordReset>[0]["userRepository"],
    verificationService: ConstructorParameters<
      typeof RequestPasswordReset
    >[0]["verificationService"],
    securityLogRepository: ConstructorParameters<
      typeof RequestPasswordReset
    >[0]["securityLogRepository"],
  ) =>
    new RequestPasswordReset({
      userRepository,
      verificationService,
      securityLogRepository,
      logger: new Logger(RequestPasswordReset.name),
    }),
};

export const requestPasswordSetupCodeProvider: FactoryProvider<RequestPasswordSetupCode> = {
  provide: RequestPasswordSetupCode,
  inject: [AUTH_USER_REPOSITORY, AUTH_ACCOUNT_REPOSITORY, VerificationService],
  useFactory: (
    userRepository: ConstructorParameters<typeof RequestPasswordSetupCode>[0]["userRepository"],
    accountRepository: ConstructorParameters<
      typeof RequestPasswordSetupCode
    >[0]["accountRepository"],
    verificationService: ConstructorParameters<
      typeof RequestPasswordSetupCode
    >[0]["verificationService"],
  ) =>
    new RequestPasswordSetupCode({
      userRepository,
      accountRepository,
      verificationService,
    }),
};

export const resendVerificationProvider: FactoryProvider<ResendVerification> = {
  provide: ResendVerification,
  inject: [AUTH_USER_REPOSITORY, VerificationService, UNIT_OF_WORK],
  useFactory: (
    userRepository: ConstructorParameters<typeof ResendVerification>[0]["userRepository"],
    verificationService: ConstructorParameters<typeof ResendVerification>[0]["verificationService"],
    unitOfWork: ConstructorParameters<typeof ResendVerification>[0]["unitOfWork"],
  ) =>
    new ResendVerification({
      userRepository,
      verificationService,
      unitOfWork,
      logger: new Logger(ResendVerification.name),
    }),
};

export const resetPasswordProvider: FactoryProvider<ResetPassword> = {
  provide: ResetPassword,
  inject: [
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    VerificationService,
    AUTH_SESSION_REPOSITORY,
    AUTH_CACHE,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof ResetPassword>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof ResetPassword>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof ResetPassword>[0]["passwordService"],
    verificationService: ConstructorParameters<typeof ResetPassword>[0]["verificationService"],
    sessionRepository: ConstructorParameters<typeof ResetPassword>[0]["sessionRepository"],
    cacheService: ConstructorParameters<typeof ResetPassword>[0]["cacheService"],
    securityLogRepository: ConstructorParameters<typeof ResetPassword>[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof ResetPassword>[0]["unitOfWork"],
  ) =>
    new ResetPassword({
      userRepository,
      accountRepository,
      passwordService,
      verificationService,
      sessionRepository,
      cacheService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(ResetPassword.name),
    }),
};

export const revokeSessionProvider: FactoryProvider<RevokeSession> = {
  provide: RevokeSession,
  inject: [AUTH_SESSION_REPOSITORY, AUTH_SECURITY_LOG_REPOSITORY, AUTH_CACHE],
  useFactory: (
    sessionRepository: ConstructorParameters<typeof RevokeSession>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<typeof RevokeSession>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof RevokeSession>[0]["cacheService"],
  ) =>
    new RevokeSession({
      sessionRepository,
      securityLogRepository,
      cacheService,
      logger: new Logger(RevokeSession.name),
    }),
};
export const setPasswordProvider: FactoryProvider<SetPassword> = {
  provide: SetPassword,
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
    userRepository: ConstructorParameters<typeof SetPassword>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof SetPassword>[0]["accountRepository"],
    passwordService: ConstructorParameters<typeof SetPassword>[0]["passwordService"],
    verificationService: ConstructorParameters<typeof SetPassword>[0]["verificationService"],
    securityLogRepository: ConstructorParameters<typeof SetPassword>[0]["securityLogRepository"],
    cacheService: ConstructorParameters<typeof SetPassword>[0]["cacheService"],
    unitOfWork: ConstructorParameters<typeof SetPassword>[0]["unitOfWork"],
  ) =>
    new SetPassword({
      userRepository,
      accountRepository,
      passwordService,
      verificationService,
      securityLogRepository,
      cacheService,
      unitOfWork,
      logger: new Logger(SetPassword.name),
    }),
};

export const startOAuthAuthorizationProvider: FactoryProvider<StartOAuthAuthorization> = {
  provide: StartOAuthAuthorization,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof StartOAuthAuthorization>[0]["workflow"]) =>
    new StartOAuthAuthorization({ workflow }),
};

export const unlinkOAuthAccountProvider: FactoryProvider<UnlinkOAuthAccount> = {
  provide: UnlinkOAuthAccount,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof UnlinkOAuthAccount>[0]["workflow"]) =>
    new UnlinkOAuthAccount({ workflow }),
};

export const updateProfileProvider: FactoryProvider<UpdateProfile> = {
  provide: UpdateProfile,
  inject: [AUTH_USER_REPOSITORY, AUTH_CACHE],
  useFactory: (
    userRepository: ConstructorParameters<typeof UpdateProfile>[0]["userRepository"],
    cacheService: ConstructorParameters<typeof UpdateProfile>[0]["cacheService"],
  ) =>
    new UpdateProfile({
      userRepository,
      cacheService,
      logger: new Logger(UpdateProfile.name),
    }),
};

export const verifyEmailProvider: FactoryProvider<VerifyEmail> = {
  provide: VerifyEmail,
  inject: [
    AUTH_USER_REPOSITORY,
    VerificationService,
    RETENTION_ENROLLER,
    SessionService,
    AUTH_SECURITY_LOG_REPOSITORY,
    UNIT_OF_WORK,
  ],
  useFactory: (
    userRepository: ConstructorParameters<typeof VerifyEmail>[0]["userRepository"],
    verificationService: ConstructorParameters<typeof VerifyEmail>[0]["verificationService"],
    retentionEnroller: ConstructorParameters<typeof VerifyEmail>[0]["retentionEnroller"],
    sessionService: ConstructorParameters<typeof VerifyEmail>[0]["sessionService"],
    securityLogRepository: ConstructorParameters<typeof VerifyEmail>[0]["securityLogRepository"],
    unitOfWork: ConstructorParameters<typeof VerifyEmail>[0]["unitOfWork"],
  ) =>
    new VerifyEmail({
      userRepository,
      verificationService,
      retentionEnroller,
      sessionService,
      securityLogRepository,
      unitOfWork,
      logger: new Logger(VerifyEmail.name),
    }),
};

export const oauthWorkflowProvider: FactoryProvider<OAuthWorkflow> = {
  provide: OAuthWorkflow,
  inject: [
    UNIT_OF_WORK,
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_OAUTH_STATE_REPOSITORY,
    AUTH_RUNTIME_CONFIG,
    AUTH_REGISTRATION_NOTIFIER,
    AUTH_CACHE,
    IssueLogin,
    ProvisionUser,
    OAUTH_IDENTITY_PROVIDER_REGISTRY,
    RestoreAccount,
  ],
  useFactory: (
    unitOfWork: ConstructorParameters<typeof OAuthWorkflow>[0]["unitOfWork"],
    userRepository: ConstructorParameters<typeof OAuthWorkflow>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof OAuthWorkflow>[0]["accountRepository"],
    securityLogRepository: ConstructorParameters<typeof OAuthWorkflow>[0]["securityLogRepository"],
    loginAttemptRepository: ConstructorParameters<
      typeof OAuthWorkflow
    >[0]["loginAttemptRepository"],
    oauthStateRepository: ConstructorParameters<typeof OAuthWorkflow>[0]["oauthStateRepository"],
    configService: ConstructorParameters<typeof OAuthWorkflow>[0]["configService"],
    adminEventNotifier: ConstructorParameters<typeof OAuthWorkflow>[0]["adminEventNotifier"],
    cacheService: ConstructorParameters<typeof OAuthWorkflow>[0]["cacheService"],
    issueLoginUseCase: ConstructorParameters<typeof OAuthWorkflow>[0]["issueLoginUseCase"],
    provisionUserUseCase: ConstructorParameters<typeof OAuthWorkflow>[0]["provisionUserUseCase"],
    registry: ConstructorParameters<typeof OAuthWorkflow>[0]["registry"],
    restoreAccount: ConstructorParameters<typeof OAuthWorkflow>[0]["restoreAccount"],
  ) =>
    new OAuthWorkflow({
      unitOfWork,
      userRepository,
      accountRepository,
      securityLogRepository,
      loginAttemptRepository,
      oauthStateRepository,
      configService,
      adminEventNotifier,
      cacheService,
      issueLoginUseCase,
      provisionUserUseCase,
      registry,
      restoreAccount,
      logger: new Logger(OAuthWorkflow.name),
    }),
};

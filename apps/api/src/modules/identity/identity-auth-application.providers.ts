import { Logger, type FactoryProvider } from "@nestjs/common";

import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

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
import { RefreshTokens } from "./application/use-cases/auth/refresh-tokens.use-case.js";
import { Register } from "./application/use-cases/auth/register.use-case.js";
import { RequestPasswordReset } from "./application/use-cases/auth/request-password-reset.use-case.js";
import { RequestPasswordSetupCode } from "./application/use-cases/auth/request-password-setup-code.use-case.js";
import { ResendVerification } from "./application/use-cases/auth/resend-verification.use-case.js";
import { ResetPassword } from "./application/use-cases/auth/reset-password.use-case.js";
import { RevokeSession } from "./application/use-cases/auth/revoke-session.use-case.js";
import { SetPassword } from "./application/use-cases/auth/set-password.use-case.js";
import { StartOAuthAuthorization } from "./application/use-cases/auth/start-oauth-authorization.use-case.js";
import { UnlinkOAuthAccount } from "./application/use-cases/auth/unlink-oauth-account.use-case.js";
import { UpdateProfile } from "./application/use-cases/auth/update-profile.use-case.js";
import { VerifyEmail } from "./application/use-cases/auth/verify-email.use-case.js";
import { CredentialAuthWorkflow } from "./application/workflows/auth/credential-auth.workflow.js";
import { OAuthWorkflow } from "./application/workflows/auth/oauth.workflow.js";
import { PasswordWorkflow } from "./application/workflows/auth/password.workflow.js";

export const getCurrentUserProvider: FactoryProvider<GetCurrentUser> = {
  provide: GetCurrentUser,
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof GetCurrentUser>[0]["workflow"]) =>
    new GetCurrentUser({ workflow }),
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
  inject: [PasswordWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof ChangePassword>[0]["workflow"]) =>
    new ChangePassword({ workflow }),
};

export const completeOAuthAuthorizationProvider: FactoryProvider<CompleteOAuthAuthorization> = {
  provide: CompleteOAuthAuthorization,
  inject: [OAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof CompleteOAuthAuthorization>[0]["workflow"]) =>
    new CompleteOAuthAuthorization({ workflow }),
};

export const deleteAccountProvider: FactoryProvider<DeleteAccount> = {
  provide: DeleteAccount,
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof DeleteAccount>[0]["workflow"]) =>
    new DeleteAccount({ workflow }),
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
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof LoginWithPassword>[0]["workflow"]) =>
    new LoginWithPassword({ workflow }),
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
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof Register>[0]["workflow"]) =>
    new Register({ workflow }),
};

export const requestPasswordResetProvider: FactoryProvider<RequestPasswordReset> = {
  provide: RequestPasswordReset,
  inject: [PasswordWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof RequestPasswordReset>[0]["workflow"]) =>
    new RequestPasswordReset({ workflow }),
};

export const requestPasswordSetupCodeProvider: FactoryProvider<RequestPasswordSetupCode> = {
  provide: RequestPasswordSetupCode,
  inject: [PasswordWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof RequestPasswordSetupCode>[0]["workflow"]) =>
    new RequestPasswordSetupCode({ workflow }),
};

export const resendVerificationProvider: FactoryProvider<ResendVerification> = {
  provide: ResendVerification,
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof ResendVerification>[0]["workflow"]) =>
    new ResendVerification({ workflow }),
};

export const resetPasswordProvider: FactoryProvider<ResetPassword> = {
  provide: ResetPassword,
  inject: [PasswordWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof ResetPassword>[0]["workflow"]) =>
    new ResetPassword({ workflow }),
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
  inject: [PasswordWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof SetPassword>[0]["workflow"]) =>
    new SetPassword({ workflow }),
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
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof UpdateProfile>[0]["workflow"]) =>
    new UpdateProfile({ workflow }),
};

export const verifyEmailProvider: FactoryProvider<VerifyEmail> = {
  provide: VerifyEmail,
  inject: [CredentialAuthWorkflow],
  useFactory: (workflow: ConstructorParameters<typeof VerifyEmail>[0]["workflow"]) =>
    new VerifyEmail({ workflow }),
};

export const credentialAuthWorkflowProvider: FactoryProvider<CredentialAuthWorkflow> = {
  provide: CredentialAuthWorkflow,
  inject: [
    UNIT_OF_WORK,
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SESSION_REPOSITORY,
    AUTH_LOGIN_ATTEMPT_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    SessionService,
    VerificationService,
    AUTH_CACHE,
    AUTH_REGISTRATION_NOTIFIER,
    IssueLogin,
    ProvisionUser,
    RETENTION_ENROLLER,
  ],
  useFactory: (
    unitOfWork: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["unitOfWork"],
    userRepository: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["accountRepository"],
    sessionRepository: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["sessionRepository"],
    loginAttemptRepository: ConstructorParameters<
      typeof CredentialAuthWorkflow
    >[0]["loginAttemptRepository"],
    securityLogRepository: ConstructorParameters<
      typeof CredentialAuthWorkflow
    >[0]["securityLogRepository"],
    passwordService: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["passwordService"],
    sessionService: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["sessionService"],
    verificationService: ConstructorParameters<
      typeof CredentialAuthWorkflow
    >[0]["verificationService"],
    cacheService: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["cacheService"],
    adminEventNotifier: ConstructorParameters<
      typeof CredentialAuthWorkflow
    >[0]["adminEventNotifier"],
    issueLoginUseCase: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["issueLoginUseCase"],
    provisionUserUseCase: ConstructorParameters<
      typeof CredentialAuthWorkflow
    >[0]["provisionUserUseCase"],
    retentionEnroller: ConstructorParameters<typeof CredentialAuthWorkflow>[0]["retentionEnroller"],
  ) =>
    new CredentialAuthWorkflow({
      unitOfWork,
      userRepository,
      accountRepository,
      sessionRepository,
      loginAttemptRepository,
      securityLogRepository,
      passwordService,
      sessionService,
      verificationService,
      cacheService,
      adminEventNotifier,
      issueLoginUseCase,
      provisionUserUseCase,
      retentionEnroller,
      logger: new Logger(CredentialAuthWorkflow.name),
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
      logger: new Logger(OAuthWorkflow.name),
    }),
};

export const passwordWorkflowProvider: FactoryProvider<PasswordWorkflow> = {
  provide: PasswordWorkflow,
  inject: [
    UNIT_OF_WORK,
    AUTH_USER_REPOSITORY,
    AUTH_ACCOUNT_REPOSITORY,
    AUTH_SESSION_REPOSITORY,
    AUTH_SECURITY_LOG_REPOSITORY,
    AUTH_PASSWORD_HASHER,
    VerificationService,
  ],
  useFactory: (
    unitOfWork: ConstructorParameters<typeof PasswordWorkflow>[0]["unitOfWork"],
    userRepository: ConstructorParameters<typeof PasswordWorkflow>[0]["userRepository"],
    accountRepository: ConstructorParameters<typeof PasswordWorkflow>[0]["accountRepository"],
    sessionRepository: ConstructorParameters<typeof PasswordWorkflow>[0]["sessionRepository"],
    securityLogRepository: ConstructorParameters<
      typeof PasswordWorkflow
    >[0]["securityLogRepository"],
    passwordService: ConstructorParameters<typeof PasswordWorkflow>[0]["passwordService"],
    verificationService: ConstructorParameters<typeof PasswordWorkflow>[0]["verificationService"],
  ) =>
    new PasswordWorkflow({
      unitOfWork,
      userRepository,
      accountRepository,
      sessionRepository,
      securityLogRepository,
      passwordService,
      verificationService,
      logger: new Logger(PasswordWorkflow.name),
    }),
};

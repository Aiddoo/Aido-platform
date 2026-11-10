import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { AuthAccountRepositoryPort } from "./application/ports/auth-account.repository.port.js";
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
import { AuthLoginAttemptRepositoryPort } from "./application/ports/auth-login-attempt.repository.port.js";
import { AuthOAuthStateRepositoryPort } from "./application/ports/auth-oauth-state.repository.port.js";
import { AuthSecurityLogRepositoryPort } from "./application/ports/auth-security-log.repository.port.js";
import { AuthSessionRepositoryPort } from "./application/ports/auth-session.repository.port.js";
import { AuthUserRepositoryPort } from "./application/ports/auth-user.repository.port.js";
import { AuthVerificationRepositoryPort } from "./application/ports/auth-verification.repository.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { UserProvisioningSeederPort } from "./application/ports/user-provisioning-seeder.port.js";
import { VerificationCodeSecurityPort } from "./application/ports/verification-code-security.port.js";
import { AuthenticateSessionUseCase } from "./application/use-cases/authenticate-session.use-case.js";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case.js";
import { CompleteOAuthAuthorizationUseCase } from "./application/use-cases/complete-oauth-authorization.use-case.js";
import { ConsumeVerificationCodeUseCase } from "./application/use-cases/consume-verification-code.use-case.js";
import { CreateSessionUseCase } from "./application/use-cases/create-session.use-case.js";
import { ExchangeOAuthCodeUseCase } from "./application/use-cases/exchange-oauth-code.use-case.js";
import { GetOAuthRedirectUriUseCase } from "./application/use-cases/get-oauth-redirect-uri.use-case.js";
import { IssueLoginUseCase } from "./application/use-cases/issue-login.use-case.js";
import { IssueVerificationCodeUseCase } from "./application/use-cases/issue-verification-code.use-case.js";
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
import { RefreshTokensUseCase } from "./application/use-cases/refresh-tokens.use-case.js";
import { RegisterUseCase } from "./application/use-cases/register.use-case.js";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case.js";
import { RequestPasswordSetupCodeUseCase } from "./application/use-cases/request-password-setup-code.use-case.js";
import { ResendVerificationUseCase } from "./application/use-cases/resend-verification.use-case.js";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case.js";
import { RestoreAccountUseCase } from "./application/use-cases/restore-account.use-case.js";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case.js";
import { SendVerificationCodeUseCase } from "./application/use-cases/send-verification-code.use-case.js";
import { SetPasswordUseCase } from "./application/use-cases/set-password.use-case.js";
import { StartOAuthAuthorizationUseCase } from "./application/use-cases/start-oauth-authorization.use-case.js";
import { UnlinkOAuthAccountUseCase } from "./application/use-cases/unlink-oauth-account.use-case.js";
import { VerifyEmailUseCase } from "./application/use-cases/verify-email.use-case.js";

export const getOAuthRedirectUriProvider = provideUseCase(GetOAuthRedirectUriUseCase, {
  oauthStateRepository: AuthOAuthStateRepositoryPort,
  clock: ClockPort,
});

export const listActiveSessionsProvider = provideUseCase(ListActiveSessionsUseCase, {
  sessionRepository: AuthSessionRepositoryPort,
  clock: ClockPort,
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

export const issueVerificationCodeProvider = provideUseCase(IssueVerificationCodeUseCase, {
  verificationRepository: AuthVerificationRepositoryPort,
  verificationCodeSecurity: VerificationCodeSecurityPort,
  clock: ClockPort,
  logger: loggerFor(IssueVerificationCodeUseCase),
});

export const sendVerificationCodeProvider = provideUseCase(SendVerificationCodeUseCase, {
  emailSender: AuthEmailSenderPort,
  logger: loggerFor(SendVerificationCodeUseCase),
});

export const consumeVerificationCodeProvider = provideUseCase(ConsumeVerificationCodeUseCase, {
  verificationRepository: AuthVerificationRepositoryPort,
  verificationCodeSecurity: VerificationCodeSecurityPort,
  clock: ClockPort,
  logger: loggerFor(ConsumeVerificationCodeUseCase),
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
  clock: ClockPort,
  logger: loggerFor(ChangePasswordUseCase),
});

export const completeOAuthAuthorizationProvider = provideUseCase(
  CompleteOAuthAuthorizationUseCase,
  {
    registry: OAuthIdentityProviderRegistryPort,
    oauthStateRepository: AuthOAuthStateRepositoryPort,
    loginWithOAuthToken: LoginWithOAuthTokenUseCase,
    clock: ClockPort,
    logger: loggerFor(CompleteOAuthAuthorizationUseCase),
  },
);

export const restoreAccountProvider = provideUseCase(RestoreAccountUseCase, {
  userRepository: AuthUserRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
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
  clock: ClockPort,
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
  clock: ClockPort,
  logger: loggerFor(LogoutUseCase),
});
export const logoutAllProvider = provideUseCase(LogoutAllUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  clock: ClockPort,
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
  alert: OperationalAlertPort,
});
export const registerProvider = provideUseCase(RegisterUseCase, {
  userRepository: AuthUserRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  provisionUserUseCase: ProvisionUserUseCase,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  adminEventNotifier: AuthRegistrationNotifierPort,
  clock: ClockPort,
  logger: loggerFor(RegisterUseCase),
});

export const requestPasswordResetProvider = provideUseCase(RequestPasswordResetUseCase, {
  userRepository: AuthUserRepositoryPort,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  logger: loggerFor(RequestPasswordResetUseCase),
});

export const requestPasswordSetupCodeProvider = provideUseCase(RequestPasswordSetupCodeUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
});

export const resendVerificationProvider = provideUseCase(ResendVerificationUseCase, {
  userRepository: AuthUserRepositoryPort,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(ResendVerificationUseCase),
});

export const resetPasswordProvider = provideUseCase(ResetPasswordUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  sessionRepository: AuthSessionRepositoryPort,
  cacheService: AuthCachePort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(ResetPasswordUseCase),
});

export const revokeSessionProvider = provideUseCase(RevokeSessionUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: AuthSessionRepositoryPort,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  clock: ClockPort,
  logger: loggerFor(RevokeSessionUseCase),
});
export const setPasswordProvider = provideUseCase(SetPasswordUseCase, {
  userRepository: AuthUserRepositoryPort,
  accountRepository: AuthAccountRepositoryPort,
  passwordService: AuthPasswordHasherPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  cacheService: AuthCachePort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(SetPasswordUseCase),
});

export const startOAuthAuthorizationProvider = provideUseCase(StartOAuthAuthorizationUseCase, {
  registry: OAuthIdentityProviderRegistryPort,
  oauthStateRepository: AuthOAuthStateRepositoryPort,
  configService: AuthRuntimeConfigPort,
  clock: ClockPort,
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

export const verifyEmailProvider = provideUseCase(VerifyEmailUseCase, {
  userRepository: AuthUserRepositoryPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  retentionEnroller: RetentionEnrollerPort,
  sessionService: CreateSessionUseCase,
  securityLogRepository: AuthSecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(VerifyEmailUseCase),
});

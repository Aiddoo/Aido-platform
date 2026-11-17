import type { Provider } from "@nestjs/common";

import { EntitlementCacheInvalidatorPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { LinkedAccountsRepositoryPort } from "../linked-accounts/application/ports/linked-accounts.repository.port.js";
import { OAuthIdentityProviderRegistryPort } from "../linked-accounts/application/ports/oauth-identity-provider.port.js";
import { PasswordHasherPort } from "../linked-accounts/application/ports/password-hasher.port.js";
import { RetentionEnrollerPort } from "../users/application/ports/retention-enroller.port.js";
import { SecurityLogRepositoryPort } from "../users/application/ports/security-log.repository.port.js";
import { UserMutationLockPort } from "../users/application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "../users/application/ports/user-profile-invalidator.port.js";
import { UserRepositoryPort } from "../users/application/ports/user.repository.port.js";
import { NotifyOAuthSignupUseCase } from "../users/application/use-cases/notify-oauth-signup.use-case.js";
import { ProvisionUserUseCase } from "../users/application/use-cases/provision-user.use-case.js";
import { RestoreAccountUseCase } from "../users/application/use-cases/restore-account.use-case.js";
import { ConsumeVerificationCodeUseCase } from "../verifications/application/use-cases/consume-verification-code.use-case.js";
import { LoginAttemptRepositoryPort } from "./application/ports/login-attempt.repository.port.js";
import { SessionCachePort } from "./application/ports/session-cache.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { SessionRepositoryPort } from "./application/ports/session.repository.port.js";
import { TokenIssuerPort } from "./application/ports/token-issuer.port.js";
import { AuthenticateSessionUseCase } from "./application/use-cases/authenticate-session.use-case.js";
import { CreateSessionUseCase } from "./application/use-cases/create-session.use-case.js";
import { IssueLoginUseCase } from "./application/use-cases/issue-login.use-case.js";
import { ListActiveSessionsUseCase } from "./application/use-cases/list-active-sessions.use-case.js";
import { LoginWithMobileOAuthTokenUseCase } from "./application/use-cases/login-with-mobile-oauth-token.use-case.js";
import { LoginWithOAuthTokenUseCase } from "./application/use-cases/login-with-oauth-token.use-case.js";
import { LoginWithPasswordUseCase } from "./application/use-cases/login-with-password.use-case.js";
import { LogoutAllUseCase } from "./application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshTokensUseCase } from "./application/use-cases/refresh-tokens.use-case.js";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case.js";
import { VerifyEmailUseCase } from "./application/use-cases/verify-email.use-case.js";
import { JwtTokenIssuerAdapter } from "./infrastructure/adapters/jwt-token-issuer.adapter.js";
import { DrizzleLoginAttemptRepository } from "./infrastructure/persistence/drizzle-login-attempt.repository.js";

export const createSessionProvider = provideUseCase(CreateSessionUseCase, {
  sessionRepository: SessionRepositoryPort,
  tokenService: TokenIssuerPort,
  clock: ClockPort,
});

const authenticateSessionProvider = provideUseCase(AuthenticateSessionUseCase, {
  sessionRepository: SessionRepositoryPort,
  userRepository: UserRepositoryPort,
  cache: SessionCachePort,
  clock: ClockPort,
  logger: loggerFor(AuthenticateSessionUseCase),
});

const listActiveSessionsProvider = provideUseCase(ListActiveSessionsUseCase, {
  sessionRepository: SessionRepositoryPort,
  clock: ClockPort,
});

export const issueLoginProvider = provideUseCase(IssueLoginUseCase, {
  sessionService: CreateSessionUseCase,
  loginAttemptRepository: LoginAttemptRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  userRepository: UserRepositoryPort,
  clock: ClockPort,
});

export const loginWithPasswordProvider = provideUseCase(LoginWithPasswordUseCase, {
  userRepository: UserRepositoryPort,
  userMutationLock: UserMutationLockPort,
  accountRepository: LinkedAccountsRepositoryPort,
  loginAttemptRepository: LoginAttemptRepositoryPort,
  passwordService: PasswordHasherPort,
  securityLogRepository: SecurityLogRepositoryPort,
  issueLoginUseCase: IssueLoginUseCase,
  restoreAccount: RestoreAccountUseCase,
  cacheService: UserProfileInvalidatorPort,
  entitlementCache: EntitlementCacheInvalidatorPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(LoginWithPasswordUseCase),
});

export const loginWithOAuthTokenProvider = provideUseCase(LoginWithOAuthTokenUseCase, {
  registry: OAuthIdentityProviderRegistryPort,
  userRepository: UserRepositoryPort,
  userMutationLock: UserMutationLockPort,
  accountRepository: LinkedAccountsRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  loginAttemptRepository: LoginAttemptRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: UserProfileInvalidatorPort,
  entitlementCache: EntitlementCacheInvalidatorPort,
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

export const verifyEmailProvider = provideUseCase(VerifyEmailUseCase, {
  userRepository: UserRepositoryPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  retentionEnroller: RetentionEnrollerPort,
  sessionService: CreateSessionUseCase,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(VerifyEmailUseCase),
});

const refreshTokensProvider = provideUseCase(RefreshTokensUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: SessionRepositoryPort,
  tokenService: TokenIssuerPort,
  userRepository: UserRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  cacheService: SessionCachePort,
  clock: ClockPort,
  logger: loggerFor(RefreshTokensUseCase),
  alert: OperationalAlertPort,
});

const logoutProvider = provideUseCase(LogoutUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: SessionRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  cacheService: SessionCachePort,
  clock: ClockPort,
  logger: loggerFor(LogoutUseCase),
});

const logoutAllProvider = provideUseCase(LogoutAllUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: SessionRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  cacheService: SessionCachePort,
  clock: ClockPort,
  logger: loggerFor(LogoutAllUseCase),
});

const revokeSessionProvider = provideUseCase(RevokeSessionUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  sessionRepository: SessionRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  cacheService: SessionCachePort,
  clock: ClockPort,
  logger: loggerFor(RevokeSessionUseCase),
});

export const IDENTITY_SESSIONS_PROVIDERS = [
  { provide: LoginAttemptRepositoryPort, useClass: DrizzleLoginAttemptRepository },
  { provide: TokenIssuerPort, useClass: JwtTokenIssuerAdapter },
  createSessionProvider,
  authenticateSessionProvider,
  listActiveSessionsProvider,
  issueLoginProvider,
  loginWithPasswordProvider,
  loginWithOAuthTokenProvider,
  loginWithMobileOAuthTokenProvider,
  verifyEmailProvider,
  refreshTokensProvider,
  logoutProvider,
  logoutAllProvider,
  revokeSessionProvider,
] satisfies Provider[];

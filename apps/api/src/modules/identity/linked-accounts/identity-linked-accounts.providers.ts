import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { SessionCachePort } from "../sessions/application/ports/session-cache.port.js";
import { SessionPushDeviceReleaserPort } from "../sessions/application/ports/session-push-device-releaser.port.js";
import { SessionRepositoryPort } from "../sessions/application/ports/session.repository.port.js";
import { SecurityLogRepositoryPort } from "../users/application/ports/security-log.repository.port.js";
import { UserMutationLockPort } from "../users/application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "../users/application/ports/user-profile-invalidator.port.js";
import { UserRepositoryPort } from "../users/application/ports/user.repository.port.js";
import { CheckVerificationEmailCapUseCase } from "../verifications/application/use-cases/check-verification-email-cap.use-case.js";
import { ConsumeVerificationCodeUseCase } from "../verifications/application/use-cases/consume-verification-code.use-case.js";
import { IssueVerificationCodeUseCase } from "../verifications/application/use-cases/issue-verification-code.use-case.js";
import { RecordVerificationEmailSentUseCase } from "../verifications/application/use-cases/record-verification-email-sent.use-case.js";
import { SendVerificationCodeUseCase } from "../verifications/application/use-cases/send-verification-code.use-case.js";
import { LinkedAccountsRepositoryPort } from "./application/ports/linked-accounts.repository.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { PasswordHasherPort } from "./application/ports/password-hasher.port.js";
import { PasswordResetCooldownPort } from "./application/ports/password-reset-cooldown.port.js";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case.js";
import { LinkOAuthAccountUseCase } from "./application/use-cases/link-oauth-account.use-case.js";
import { LinkOAuthIdentityUseCase } from "./application/use-cases/link-oauth-identity.use-case.js";
import { ListLinkedAccountsUseCase } from "./application/use-cases/list-linked-accounts.use-case.js";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case.js";
import { RequestPasswordSetupCodeUseCase } from "./application/use-cases/request-password-setup-code.use-case.js";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case.js";
import { SetPasswordUseCase } from "./application/use-cases/set-password.use-case.js";
import { UnlinkOAuthAccountUseCase } from "./application/use-cases/unlink-oauth-account.use-case.js";
import { AppleOAuthIdentityAdapter } from "./infrastructure/adapters/apple-oauth-identity.adapter.js";
import { Argon2PasswordHasherAdapter } from "./infrastructure/adapters/argon2-password-hasher.adapter.js";
import { GoogleOAuthIdentityAdapter } from "./infrastructure/adapters/google-oauth-identity.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./infrastructure/adapters/kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./infrastructure/adapters/naver-oauth-identity.adapter.js";
import { OAuthIdentityProviderRegistryAdapter } from "./infrastructure/adapters/oauth-identity-provider-registry.adapter.js";
import { PasswordResetCooldownAdapter } from "./infrastructure/adapters/password-reset-cooldown.adapter.js";
import { DrizzleLinkedAccountsRepository } from "./infrastructure/persistence/drizzle-linked-accounts.repository.js";

export const listLinkedAccountsProvider = provideUseCase(ListLinkedAccountsUseCase, {
  accountRepository: LinkedAccountsRepositoryPort,
});

export const linkOAuthIdentityProvider = provideUseCase(LinkOAuthIdentityUseCase, {
  accountRepository: LinkedAccountsRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  clock: ClockPort,
});

export const linkOAuthAccountProvider = provideUseCase(LinkOAuthAccountUseCase, {
  userMutationLock: UserMutationLockPort,
  registry: OAuthIdentityProviderRegistryPort,
  linkOAuthIdentity: LinkOAuthIdentityUseCase,
  unitOfWork: UnitOfWorkPort,
  cacheService: UserProfileInvalidatorPort,
  logger: loggerFor(LinkOAuthAccountUseCase),
});

export const unlinkOAuthAccountProvider = provideUseCase(UnlinkOAuthAccountUseCase, {
  userMutationLock: UserMutationLockPort,
  accountRepository: LinkedAccountsRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: UserProfileInvalidatorPort,
  logger: loggerFor(UnlinkOAuthAccountUseCase),
});

export const changePasswordProvider = provideUseCase(ChangePasswordUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: UserRepositoryPort,
  userMutationLock: UserMutationLockPort,
  accountRepository: LinkedAccountsRepositoryPort,
  passwordService: PasswordHasherPort,
  sessionRepository: SessionRepositoryPort,
  cacheService: SessionCachePort,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(ChangePasswordUseCase),
});

export const requestPasswordResetProvider = provideUseCase(RequestPasswordResetUseCase, {
  userRepository: UserRepositoryPort,
  checkVerificationEmailCap: CheckVerificationEmailCapUseCase,
  recordVerificationEmailSent: RecordVerificationEmailSentUseCase,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  securityLogRepository: SecurityLogRepositoryPort,
  resetCooldown: PasswordResetCooldownPort,
  clock: ClockPort,
  logger: loggerFor(RequestPasswordResetUseCase),
});

export const resetPasswordProvider = provideUseCase(ResetPasswordUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: UserRepositoryPort,
  userMutationLock: UserMutationLockPort,
  accountRepository: LinkedAccountsRepositoryPort,
  passwordService: PasswordHasherPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  sessionRepository: SessionRepositoryPort,
  cacheService: SessionCachePort,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(ResetPasswordUseCase),
});

export const requestPasswordSetupCodeProvider = provideUseCase(RequestPasswordSetupCodeUseCase, {
  userRepository: UserRepositoryPort,
  accountRepository: LinkedAccountsRepositoryPort,
  checkVerificationEmailCap: CheckVerificationEmailCapUseCase,
  recordVerificationEmailSent: RecordVerificationEmailSentUseCase,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
});

export const setPasswordProvider = provideUseCase(SetPasswordUseCase, {
  userRepository: UserRepositoryPort,
  accountRepository: LinkedAccountsRepositoryPort,
  passwordService: PasswordHasherPort,
  consumeVerificationCode: ConsumeVerificationCodeUseCase,
  securityLogRepository: SecurityLogRepositoryPort,
  cacheService: UserProfileInvalidatorPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(SetPasswordUseCase),
});

export const IDENTITY_LINKED_ACCOUNTS_PROVIDERS = [
  { provide: LinkedAccountsRepositoryPort, useClass: DrizzleLinkedAccountsRepository },
  { provide: PasswordHasherPort, useClass: Argon2PasswordHasherAdapter },
  { provide: PasswordResetCooldownPort, useClass: PasswordResetCooldownAdapter },
  AppleOAuthIdentityAdapter,
  GoogleOAuthIdentityAdapter,
  KakaoOAuthIdentityAdapter,
  NaverOAuthIdentityAdapter,
  { provide: OAuthIdentityProviderRegistryPort, useClass: OAuthIdentityProviderRegistryAdapter },
  listLinkedAccountsProvider,
  linkOAuthIdentityProvider,
  linkOAuthAccountProvider,
  unlinkOAuthAccountProvider,
  changePasswordProvider,
  requestPasswordResetProvider,
  resetPasswordProvider,
  requestPasswordSetupCodeProvider,
  setPasswordProvider,
] satisfies Provider[];

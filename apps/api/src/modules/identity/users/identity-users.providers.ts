import type { FactoryProvider, Provider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";
import { PREMIUM_ACCESS_READER } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { TodoCommentAccountCleanupPort } from "#api/modules/engagement/comments/engagement-comments.public";
import { NotificationAccountCleanup } from "#api/modules/notification/notification-delivery.public";
import { CHEER_USAGE_READER } from "#api/modules/social/cheers/social-cheers.public";
import { NUDGE_USAGE_READER } from "#api/modules/social/nudges/social-nudges.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import {
  USAGE_METER,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AuthAccountRepositoryPort } from "../auth/application/ports/auth-account.repository.port.js";
import { AuthCachePort } from "../auth/application/ports/auth-collaboration.port.js";
import { AuthPasswordHasherPort } from "../auth/application/ports/auth-crypto.port.js";
import { AuthSecurityLogRepositoryPort } from "../auth/application/ports/auth-security-log.repository.port.js";
import { AuthSessionRepositoryPort } from "../auth/application/ports/auth-session.repository.port.js";
import { AuthUserRepositoryPort } from "../auth/application/ports/auth-user.repository.port.js";
import { SessionPushDeviceReleaserPort } from "../auth/application/ports/session-push-device-releaser.port.js";
import {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "./application/ports/account-cleanup.port.js";
import { DeleteAccountUseCase } from "./application/use-cases/delete-account.use-case.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case.js";
import { PurgeDeletedAccountsUseCase } from "./application/use-cases/purge-deleted-accounts.use-case.js";
import { UpdateProfileUseCase } from "./application/use-cases/update-profile.use-case.js";

export const accountNotificationCleanupProvider: FactoryProvider<AccountNotificationCleanupPort> = {
  provide: AccountNotificationCleanupPort,
  inject: [NotificationAccountCleanup],
  useFactory: (cleanup: NotificationAccountCleanup): AccountNotificationCleanupPort => cleanup,
};

export const accountTodoCommentCleanupProvider: FactoryProvider<AccountTodoCommentCleanupPort> = {
  provide: AccountTodoCommentCleanupPort,
  inject: [TodoCommentAccountCleanupPort],
  useFactory: (cleanup: TodoCommentAccountCleanupPort): AccountTodoCommentCleanupPort => cleanup,
};

export const accountUsageCleanupProvider: FactoryProvider<AccountUsageCleanupPort> = {
  provide: AccountUsageCleanupPort,
  inject: [USAGE_METER],
  useFactory: (meter: Pick<UsageMeterPort, "deleteSubject">): AccountUsageCleanupPort => ({
    cleanupInTransaction: async (userId) => {
      await meter.deleteSubject(userId);
    },
  }),
};

// 다른 Context 포트가 아직 Symbol 토큰이라 provideUseCase 대신 factory로 조립한다(Wave 2에서 클래스 토큰으로 바꾼다)
type GetCurrentUserDependencies = ConstructorParameters<typeof GetCurrentUserUseCase>[0];
const getCurrentUserProvider: FactoryProvider<GetCurrentUserUseCase> = {
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

export const IDENTITY_USERS_PROVIDERS = [
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
  accountUsageCleanupProvider,
  getCurrentUserProvider,
  purgeDeletedAccountsProvider,
  provideUseCase(UpdateProfileUseCase, {
    userRepository: AuthUserRepositoryPort,
    cacheService: AuthCachePort,
    logger: loggerFor(UpdateProfileUseCase),
  }),
  deleteAccountProvider,
] satisfies Provider[];

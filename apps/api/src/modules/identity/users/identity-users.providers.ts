import type { FactoryProvider, Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import { PremiumAccessReaderPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { TodoCommentAccountCleanupPort } from "#api/modules/engagement/comments/engagement-comments.public";
import { NotificationAccountCleanup } from "#api/modules/notification/notification-delivery.public";
import { CheerUsageReaderPort } from "#api/modules/social/cheers/social-cheers.public";
import { NudgeUsageReaderPort } from "#api/modules/social/nudges/social-nudges.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import {
  USAGE_METER,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
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
  useFactory: (cleanup: NotificationAccountCleanup): AccountNotificationCleanupPort => ({
    cleanupInTransaction: (userId) => cleanup.cleanupInTransaction(userId.value),
    settleAfterCommit: (result) => cleanup.settleAfterCommit(result),
  }),
};

export const accountTodoCommentCleanupProvider: FactoryProvider<AccountTodoCommentCleanupPort> = {
  provide: AccountTodoCommentCleanupPort,
  inject: [TodoCommentAccountCleanupPort],
  // 두 포트가 같은 UserId 시그니처라 그대로 넘긴다. useExisting과 달리 반환 타입이 시그니처를 검사한다
  useFactory: (cleanup: TodoCommentAccountCleanupPort): AccountTodoCommentCleanupPort => cleanup,
};

export const accountUsageCleanupProvider: FactoryProvider<AccountUsageCleanupPort> = {
  provide: AccountUsageCleanupPort,
  inject: [USAGE_METER],
  useFactory: (meter: Pick<UsageMeterPort, "deleteSubject">): AccountUsageCleanupPort => ({
    cleanupInTransaction: async (userId) => {
      await meter.deleteSubject(userId.value);
    },
  }),
};

const getCurrentUserProvider = provideUseCase(GetCurrentUserUseCase, {
  userRepository: AuthUserRepositoryPort,
  cacheService: AuthCachePort,
  premiumAccessReader: PremiumAccessReaderPort,
  entitlementReader: EntitlementReaderPort,
  quotaLedger: QuotaLedgerPort,
  cheerUsageReader: CheerUsageReaderPort,
  nudgeUsageReader: NudgeUsageReaderPort,
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
  alert: OperationalAlertPort,
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

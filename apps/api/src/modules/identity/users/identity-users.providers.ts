import type { FactoryProvider, Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { QuotaLedgerPort } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { TodoCommentAccountCleanupPort } from "#api/modules/engagement/todo-comments/engagement-todo-comments.public";
import {
  DeleteActorNotificationsUseCase,
  InvalidateRecipientUnreadCountsUseCase,
} from "#api/modules/notification/notifications/notification-notifications.public";
import { AdminEventNotifierPort } from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { TodoActivationReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import { CheerUsageReaderPort } from "#api/modules/social/cheers/social-cheers.public";
import { NudgeUsageReaderPort } from "#api/modules/social/nudges/social-nudges.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { UsageMeterPort } from "#api/platform/metering/usage-meter.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { LinkedAccountsRepositoryPort } from "../linked-accounts/application/ports/linked-accounts.repository.port.js";
import { PasswordHasherPort } from "../linked-accounts/application/ports/password-hasher.port.js";
import { OAuthStateRepositoryPort } from "../oauth-states/application/ports/oauth-state.repository.port.js";
import { LoginAttemptRepositoryPort } from "../sessions/application/ports/login-attempt.repository.port.js";
import { SessionCachePort } from "../sessions/application/ports/session-cache.port.js";
import { SessionPushDeviceReleaserPort } from "../sessions/application/ports/session-push-device-releaser.port.js";
import { SessionRepositoryPort } from "../sessions/application/ports/session.repository.port.js";
import { SessionPushDeviceReleaserAdapter } from "../sessions/infrastructure/adapters/session-push-device-releaser.adapter.js";
import { VerificationRepositoryPort } from "../verifications/application/ports/verification.repository.port.js";
import { IssueVerificationCodeUseCase } from "../verifications/application/use-cases/issue-verification-code.use-case.js";
import { SendVerificationCodeUseCase } from "../verifications/application/use-cases/send-verification-code.use-case.js";
import {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "./application/ports/account-cleanup.port.js";
import { GrowthMetricsSnapshotPort } from "./application/ports/growth-metrics-snapshot.port.js";
import { GrowthMetricsReaderPort } from "./application/ports/growth-metrics.reader.port.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { SecurityLogRepositoryPort } from "./application/ports/security-log.repository.port.js";
import { UserActivityWriterPort } from "./application/ports/user-activity-writer.port.js";
import { UserProfileCachePort } from "./application/ports/user-profile-cache.port.js";
import { UserProfileInvalidatorPort } from "./application/ports/user-profile-invalidator.port.js";
import { UserProvisioningSeederPort } from "./application/ports/user-provisioning-seeder.port.js";
import { UserRegistrationNotifierPort } from "./application/ports/user-registration-notifier.port.js";
import { UserRepositoryPort } from "./application/ports/user.repository.port.js";
import { DeleteAccountUseCase } from "./application/use-cases/delete-account.use-case.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case.js";
import { GetGrowthSummaryUseCase } from "./application/use-cases/get-growth-summary.use-case.js";
import { NotifyOAuthSignupUseCase } from "./application/use-cases/notify-oauth-signup.use-case.js";
import { ProvisionUserUseCase } from "./application/use-cases/provision-user.use-case.js";
import { PurgeDeletedAccountsUseCase } from "./application/use-cases/purge-deleted-accounts.use-case.js";
import { PurgeExpiredIdentityRecordsUseCase } from "./application/use-cases/purge-expired-identity-records.use-case.js";
import { RegisterUseCase } from "./application/use-cases/register.use-case.js";
import { RestoreAccountUseCase } from "./application/use-cases/restore-account.use-case.js";
import { UpdateProfileUseCase } from "./application/use-cases/update-profile.use-case.js";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/retention-enroller.adapter.js";
import { UserProfileCacheAdapter } from "./infrastructure/adapters/user-profile-cache.adapter.js";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/user-provisioning-seeder.adapter.js";
import { DrizzleGrowthMetricsReader } from "./infrastructure/persistence/drizzle-growth-metrics.reader.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";
import { RepeatableReadGrowthMetricsSnapshotAdapter } from "./infrastructure/persistence/repeatable-read-growth-metrics-snapshot.adapter.js";

export const accountNotificationCleanupProvider: FactoryProvider<AccountNotificationCleanupPort> = {
  provide: AccountNotificationCleanupPort,
  inject: [DeleteActorNotificationsUseCase, InvalidateRecipientUnreadCountsUseCase],
  useFactory: (
    deleteActorNotifications: DeleteActorNotificationsUseCase,
    invalidateRecipientUnreadCounts: InvalidateRecipientUnreadCountsUseCase,
  ): AccountNotificationCleanupPort => ({
    cleanupInTransaction: (userId) => deleteActorNotifications.execute({ actorId: userId }),
    settleAfterCommit: (result) =>
      invalidateRecipientUnreadCounts.execute({ userIds: result.affectedUserIds }),
  }),
};

export const accountTodoCommentCleanupProvider: FactoryProvider<AccountTodoCommentCleanupPort> = {
  provide: AccountTodoCommentCleanupPort,
  inject: [TodoCommentAccountCleanupPort],
  useFactory: (cleanup: TodoCommentAccountCleanupPort): AccountTodoCommentCleanupPort => ({
    cleanupInTransaction: (userId) => cleanup.cleanupInTransaction(userId),
    settleAfterCommit: (result) => cleanup.settleAfterCommit(result),
  }),
};

export const accountUsageCleanupProvider: FactoryProvider<AccountUsageCleanupPort> = {
  provide: AccountUsageCleanupPort,
  inject: [UsageMeterPort],
  useFactory: (meter: Pick<UsageMeterPort, "deleteSubject">): AccountUsageCleanupPort => ({
    cleanupInTransaction: async (userId) => {
      await meter.deleteSubject(userId.value);
    },
  }),
};

const userRegistrationNotifierProvider: FactoryProvider<UserRegistrationNotifierPort> = {
  provide: UserRegistrationNotifierPort,
  inject: [AdminEventNotifierPort],
  useFactory: (notifier: AdminEventNotifierPort): UserRegistrationNotifierPort => ({
    notifyUserRegistered: (payload) => notifier.notifyUserRegistered(payload),
  }),
};

export const provisionUserProvider = provideUseCase(ProvisionUserUseCase, {
  userRepository: UserRepositoryPort,
  accountRepository: LinkedAccountsRepositoryPort,
  seeder: UserProvisioningSeederPort,
  retentionEnroller: RetentionEnrollerPort,
  clock: ClockPort,
});

export const registerProvider = provideUseCase(RegisterUseCase, {
  userRepository: UserRepositoryPort,
  passwordService: PasswordHasherPort,
  provisionUserUseCase: ProvisionUserUseCase,
  issueVerificationCode: IssueVerificationCodeUseCase,
  sendVerificationCode: SendVerificationCodeUseCase,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  adminEventNotifier: UserRegistrationNotifierPort,
  clock: ClockPort,
  logger: loggerFor(RegisterUseCase),
});

export const oauthSignupNotifierProvider = provideUseCase(NotifyOAuthSignupUseCase, {
  userRepository: UserRepositoryPort,
  adminEventNotifier: UserRegistrationNotifierPort,
  logger: loggerFor(NotifyOAuthSignupUseCase),
});

export const restoreAccountProvider = provideUseCase(RestoreAccountUseCase, {
  userRepository: UserRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
});

const getCurrentUserProvider = provideUseCase(GetCurrentUserUseCase, {
  userRepository: UserRepositoryPort,
  cacheService: UserProfileCachePort,
  premiumAccessReader: PremiumAccessReaderPort,
  entitlementReader: EntitlementReaderPort,
  quotaLedger: QuotaLedgerPort,
  cheerUsageReader: CheerUsageReaderPort,
  nudgeUsageReader: NudgeUsageReaderPort,
});

const updateProfileProvider = provideUseCase(UpdateProfileUseCase, {
  userRepository: UserRepositoryPort,
  cacheService: UserProfileInvalidatorPort,
  logger: loggerFor(UpdateProfileUseCase),
});

export const deleteAccountProvider = provideUseCase(DeleteAccountUseCase, {
  pushDevices: SessionPushDeviceReleaserPort,
  userRepository: UserRepositoryPort,
  accountRepository: LinkedAccountsRepositoryPort,
  sessionRepository: SessionRepositoryPort,
  passwordService: PasswordHasherPort,
  securityLogRepository: SecurityLogRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  cacheService: SessionCachePort,
  userProfileCache: UserProfileInvalidatorPort,
  clock: ClockPort,
  logger: loggerFor(DeleteAccountUseCase),
});

export const purgeDeletedAccountsProvider = provideUseCase(PurgeDeletedAccountsUseCase, {
  userRepository: UserRepositoryPort,
  unitOfWork: UnitOfWorkPort,
  securityLogRepository: SecurityLogRepositoryPort,
  notificationCleanup: AccountNotificationCleanupPort,
  todoCommentCleanup: AccountTodoCommentCleanupPort,
  usageCleanup: AccountUsageCleanupPort,
  clock: ClockPort,
  logger: loggerFor(PurgeDeletedAccountsUseCase),
  alert: OperationalAlertPort,
});

const purgeExpiredIdentityRecordsProvider = provideUseCase(PurgeExpiredIdentityRecordsUseCase, {
  sessionRepository: SessionRepositoryPort,
  loginAttemptRepository: LoginAttemptRepositoryPort,
  verificationRepository: VerificationRepositoryPort,
  oauthStateRepository: OAuthStateRepositoryPort,
  securityLogRepository: SecurityLogRepositoryPort,
  clock: ClockPort,
  logger: loggerFor(PurgeExpiredIdentityRecordsUseCase),
});

export const IDENTITY_USERS_PROVIDERS = [
  // 폐기한 세션의 푸시 기기를 놓는 ACL이다. 세션을 폐기하는 slice마다 notification 기기 조회 Module에서 받는다
  { provide: SessionPushDeviceReleaserPort, useClass: SessionPushDeviceReleaserAdapter },
  { provide: UserProfileCachePort, useClass: UserProfileCacheAdapter },
  { provide: UserActivityWriterPort, useClass: DrizzleUserRepository },
  { provide: UserProvisioningSeederPort, useClass: UserProvisioningSeederAdapter },
  { provide: RetentionEnrollerPort, useClass: RetentionEnrollerAdapter },
  userRegistrationNotifierProvider,
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
  accountUsageCleanupProvider,
  provisionUserProvider,
  registerProvider,
  oauthSignupNotifierProvider,
  restoreAccountProvider,
  getCurrentUserProvider,
  updateProfileProvider,
  deleteAccountProvider,
  purgeDeletedAccountsProvider,
  purgeExpiredIdentityRecordsProvider,
] satisfies Provider[];

export const IDENTITY_USERS_ADMIN_PROVIDERS = [
  { provide: GrowthMetricsReaderPort, useClass: DrizzleGrowthMetricsReader },
  {
    provide: GrowthMetricsSnapshotPort,
    useClass: RepeatableReadGrowthMetricsSnapshotAdapter,
  },
  provideUseCase(GetGrowthSummaryUseCase, {
    growthMetricsReader: GrowthMetricsReaderPort,
    todoActivationReader: TodoActivationReaderPort,
    snapshot: GrowthMetricsSnapshotPort,
    clock: ClockPort,
  }),
] satisfies Provider[];

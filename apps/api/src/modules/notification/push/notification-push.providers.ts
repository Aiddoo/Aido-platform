import type { Provider } from "@nestjs/common";
import type { Redis } from "ioredis";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import {
  NotificationCachePort,
  NotificationHistoryReaderPort,
  NotificationRepositoryPort,
} from "../inbox/notification-inbox.public.js";
import { ActivePushTokenReaderPort } from "./application/ports/active-push-token.reader.port.js";
import { ClientAppVersionReaderPort } from "./application/ports/client-app-version.reader.port.js";
import { MarketingConsentReconfirmPort } from "./application/ports/marketing-consent-reconfirm.port.js";
import { MarketingPushOptOutTokenPort } from "./application/ports/marketing-push-opt-out-token.port.js";
import {
  NotificationDedupLockPort,
  NotificationDedupPort,
} from "./application/ports/notification-dedup.port.js";
import { NotificationRecipientLocaleReaderPort } from "./application/ports/notification-recipient-locale.reader.port.js";
import { NotificationRecipientPreferenceReaderPort } from "./application/ports/notification-recipient-preference.reader.port.js";
import { NotificationRecipientTimezoneReaderPort } from "./application/ports/notification-recipient-timezone.reader.port.js";
import { NotificationTodoTargetReaderPort } from "./application/ports/notification-todo-target.reader.port.js";
import { PushCampaignOutcomeReaderPort } from "./application/ports/push-campaign-outcome.reader.port.js";
import { PushDeliveryJobEnqueuerPort } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PushDeliveryLifecycleRepositoryPort } from "./application/ports/push-delivery-lifecycle.repository.port.js";
import { PushDeliveryOutboxRepositoryPort } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PushDeviceRepositoryPort } from "./application/ports/push-device.repository.port.js";
import { PushDispatchStagingRepositoryPort } from "./application/ports/push-dispatch-staging.repository.port.js";
import { PushFunnelReaderPort } from "./application/ports/push-funnel.reader.port.js";
import { PushNotificationPayloadPort } from "./application/ports/push-notification-payload.port.js";
import { PushProviderPort } from "./application/ports/push-provider.port.js";
import { PushQuietHoursReaderPort } from "./application/ports/push-quiet-hours.reader.port.js";
import { PushRateLimiterPort } from "./application/ports/push-rate-limiter.port.js";
import { PushReceiptRepositoryPort } from "./application/ports/push-receipt.repository.port.js";
import { PushTokenRepositoryPort } from "./application/ports/push-token.repository.port.js";
import { SessionPushDeviceReleasePort } from "./application/ports/session-push-device-release.port.js";
import { UserNotificationSettingsPort } from "./application/ports/user-notification-settings.port.js";
import { PushQuietHoursReader } from "./application/push-quiet-hours.reader.js";
import { DeliverPushNotificationsUseCase } from "./application/use-cases/deliver-push-notifications.use-case.js";
import { DispatchPushNotificationUseCase } from "./application/use-cases/dispatch-push-notification.use-case.js";
import { EvaluatePushDeliveryEligibilityUseCase } from "./application/use-cases/evaluate-push-delivery-eligibility.use-case.js";
import { FinalizeBatchNotificationUseCase } from "./application/use-cases/finalize-batch-notification.use-case.js";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push.use-case.js";
import { PersistBatchNotificationUseCase } from "./application/use-cases/persist-batch-notification.use-case.js";
import { PublishNotificationUseCase } from "./application/use-cases/publish-notification.use-case.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./application/use-cases/publish-push-delivery-after-commit.use-case.js";
import { PublishPushDeliveryOutboxUseCase } from "./application/use-cases/publish-push-delivery-outbox.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts.use-case.js";
import { ReconfirmMarketingConsentsUseCase } from "./application/use-cases/reconfirm-marketing-consents.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "./application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./application/use-cases/relay-push-delivery-outbox.use-case.js";
import { ReleaseSessionPushDevicesUseCase } from "./application/use-cases/release-session-push-devices.use-case.js";
import { ReportPushDeviceUseCase } from "./application/use-cases/report-push-device.use-case.js";
import { SendBatchNotificationUseCase } from "./application/use-cases/send-batch-notification.use-case.js";
import { SendBillingIssueNotificationUseCase } from "./application/use-cases/send-billing-issue-notification.use-case.js";
import { SendCheerNotificationUseCase } from "./application/use-cases/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotificationUseCase } from "./application/use-cases/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotificationUseCase } from "./application/use-cases/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "./application/use-cases/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotificationUseCase } from "./application/use-cases/send-milestone-notification.use-case.js";
import { SendNotificationWithDedupUseCase } from "./application/use-cases/send-notification-with-dedup.use-case.js";
import { SendNotificationUseCase } from "./application/use-cases/send-notification.use-case.js";
import { SendNudgeNotificationUseCase } from "./application/use-cases/send-nudge-notification.use-case.js";
import { UnregisterPushDeviceUseCase } from "./application/use-cases/unregister-push-device.use-case.js";
import { CachedActivePushTokenReaderAdapter } from "./infrastructure/adapters/cached-active-push-token-reader.adapter.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/cached-notification-recipient-preference.adapter.js";
import { ExpoPushSenderAdapter } from "./infrastructure/adapters/expo-push-sender.adapter.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/adapters/hmac-marketing-push-opt-out-token.adapter.js";
import { NotificationDedupLockAdapter } from "./infrastructure/adapters/notification-dedup-lock.adapter.js";
import { NotificationDedupAdapter } from "./infrastructure/adapters/notification-dedup.adapter.js";
import { PushNotificationPayloadMapper } from "./infrastructure/adapters/push-notification-payload.mapper.js";
import { createPushRateLimiter } from "./infrastructure/adapters/push-rate-limiter-factory.adapter.js";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/user-notification-settings.adapter.js";
import { PushDeliveryQueueAdapter } from "./infrastructure/jobs/push-delivery-queue.adapter.js";
import { DrizzleClientAppVersionReader } from "./infrastructure/persistence/drizzle-client-app-version.reader.js";
import { DrizzleNotificationTodoTargetReader } from "./infrastructure/persistence/drizzle-notification-todo-target.reader.js";
import { DrizzlePushCampaignOutcomeReader } from "./infrastructure/persistence/drizzle-push-campaign-outcome.reader.js";
import { DrizzlePushDeliveryLifecycleRepository } from "./infrastructure/persistence/drizzle-push-delivery-lifecycle.repository.js";
import { DrizzlePushDeliveryOutboxRepository } from "./infrastructure/persistence/drizzle-push-delivery-outbox.repository.js";
import { DrizzlePushDeviceRepository } from "./infrastructure/persistence/drizzle-push-device.repository.js";
import { DrizzlePushDispatchStagingRepository } from "./infrastructure/persistence/drizzle-push-dispatch-staging.repository.js";
import { DrizzlePushFunnelReader } from "./infrastructure/persistence/drizzle-push-funnel.reader.js";
import { DrizzlePushReceiptRepository } from "./infrastructure/persistence/drizzle-push-receipt.repository.js";
import { DrizzlePushTokenRepository } from "./infrastructure/persistence/drizzle-push-token.repository.js";

// 운영은 PostgreSQL, 설정으로 Redis·메모리를 고른다
const pushRateLimiterProvider = {
  provide: PushRateLimiterPort,
  useFactory: (
    configService: TypedConfigService,
    database: Database,
    redis?: Redis,
  ): PushRateLimiterPort =>
    createPushRateLimiter({
      backend: configService.pushRateLimitBackend,
      database,
      ...(redis && { redis }),
    }),
  inject: [TypedConfigService, DRIZZLE, { token: REDIS_COMMAND_CLIENT, optional: true }],
} satisfies Provider;

// 테스트 하네스가 공급자·한도기·설정 어댑터만 바꿔 끼우도록 저장소·조회 어댑터를 따로 묶는다
export const NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS = [
  { provide: PushDeviceRepositoryPort, useClass: DrizzlePushDeviceRepository },
  { provide: PushTokenRepositoryPort, useClass: DrizzlePushTokenRepository },
  { provide: PushReceiptRepositoryPort, useClass: DrizzlePushReceiptRepository },
  { provide: PushDispatchStagingRepositoryPort, useClass: DrizzlePushDispatchStagingRepository },
  { provide: PushDeliveryOutboxRepositoryPort, useClass: DrizzlePushDeliveryOutboxRepository },
  {
    provide: PushDeliveryLifecycleRepositoryPort,
    useClass: DrizzlePushDeliveryLifecycleRepository,
  },
  { provide: NotificationTodoTargetReaderPort, useClass: DrizzleNotificationTodoTargetReader },
  { provide: PushCampaignOutcomeReaderPort, useClass: DrizzlePushCampaignOutcomeReader },
  { provide: PushFunnelReaderPort, useClass: DrizzlePushFunnelReader },
  { provide: ClientAppVersionReaderPort, useClass: DrizzleClientAppVersionReader },
  { provide: ActivePushTokenReaderPort, useClass: CachedActivePushTokenReaderAdapter },
  { provide: NotificationDedupPort, useClass: NotificationDedupAdapter },
  { provide: NotificationDedupLockPort, useClass: NotificationDedupLockAdapter },
  { provide: PushDeliveryJobEnqueuerPort, useClass: PushDeliveryQueueAdapter },
  CachedNotificationRecipientPreferenceAdapter,
  {
    provide: NotificationRecipientPreferenceReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
  {
    provide: NotificationRecipientLocaleReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
  {
    provide: NotificationRecipientTimezoneReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
] satisfies Provider[];

const NOTIFICATION_PUSH_EXTERNAL_PROVIDERS = [
  { provide: PushProviderPort, useClass: ExpoPushSenderAdapter },
  pushRateLimiterProvider,
  { provide: MarketingPushOptOutTokenPort, useClass: HmacMarketingPushOptOutTokenAdapter },
  // identity 설정의 공개 capability에 잇는 ACL 어댑터 하나가 두 포트를 맡는다
  UserNotificationSettingsAdapter,
  { provide: UserNotificationSettingsPort, useExisting: UserNotificationSettingsAdapter },
  { provide: MarketingConsentReconfirmPort, useExisting: UserNotificationSettingsAdapter },
] satisfies Provider[];

export const NOTIFICATION_PUSH_USE_CASE_PROVIDERS = [
  provideUseCase(PushQuietHoursReader, { userSettings: UserNotificationSettingsPort }),
  { provide: PushQuietHoursReaderPort, useExisting: PushQuietHoursReader },
  provideUseCase(NotificationHistoryReader, {
    notificationDedup: NotificationDedupPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    logger: loggerFor(NotificationHistoryReader),
  }),
  {
    provide: PushNotificationPayloadPort,
    useFactory: (marketingOptOutTokens: MarketingPushOptOutTokenPort) =>
      new PushNotificationPayloadMapper({ marketingOptOutTokens }),
    inject: [MarketingPushOptOutTokenPort],
  },
  provideUseCase(EvaluatePushDeliveryEligibilityUseCase, {
    userSettings: UserNotificationSettingsPort,
    rateLimiter: PushRateLimiterPort,
    recipientPreferenceReader: NotificationRecipientPreferenceReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(DispatchPushNotificationUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushProvider: PushProviderPort,
    activePushTokenReader: ActivePushTokenReaderPort,
    notificationCache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(DispatchPushNotificationUseCase),
  }),
  provideUseCase(DeliverPushNotificationsUseCase, {
    lifecycle: PushDeliveryLifecycleRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eligibility: EvaluatePushDeliveryEligibilityUseCase,
    payloadFactory: PushNotificationPayloadPort,
    delivery: DispatchPushNotificationUseCase,
    clock: ClockPort,
    logger: loggerFor(DeliverPushNotificationsUseCase),
  }),
  provideUseCase(PublishPushDeliveryOutboxUseCase, {
    outbox: PushDeliveryOutboxRepositoryPort,
    enqueuer: PushDeliveryJobEnqueuerPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(PublishPushDeliveryOutboxUseCase),
  }),
  provideUseCase(PublishPushDeliveryAfterCommitUseCase, {
    afterCommit: AfterCommitTaskRegistryPort,
    publishOutbox: PublishPushDeliveryOutboxUseCase,
    logger: loggerFor(PublishPushDeliveryAfterCommitUseCase),
  }),
  provideUseCase(RecoverFailedPushDeliveriesUseCase, {
    lifecycle: PushDeliveryLifecycleRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(RelayPushDeliveryOutboxUseCase, {
    outbox: PushDeliveryOutboxRepositoryPort,
    lifecycle: PushDeliveryLifecycleRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    publishOutbox: PublishPushDeliveryOutboxUseCase,
    clock: ClockPort,
  }),
  provideUseCase(ReconcilePushReceiptsUseCase, {
    pushReceiptRepository: PushReceiptRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    pushProvider: PushProviderPort,
    cache: NotificationCachePort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(ReconcilePushReceiptsUseCase),
  }),
  provideUseCase(SendNotificationUseCase, {
    notificationRepository: NotificationRepositoryPort,
    pushDispatchStaging: PushDispatchStagingRepositoryPort,
    cache: NotificationCachePort,
    unitOfWork: UnitOfWorkPort,
    afterCommit: AfterCommitTaskRegistryPort,
    afterCommitPublisher: PublishPushDeliveryAfterCommitUseCase,
    logger: loggerFor(SendNotificationUseCase),
  }),
  provideUseCase(SendNotificationWithDedupUseCase, {
    sendNotification: SendNotificationUseCase,
    dedupLock: NotificationDedupLockPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    clock: ClockPort,
    logger: loggerFor(SendNotificationWithDedupUseCase),
  }),
  provideUseCase(PersistBatchNotificationUseCase, {
    notificationRepository: NotificationRepositoryPort,
    pushDispatchStaging: PushDispatchStagingRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    afterCommitPublisher: PublishPushDeliveryAfterCommitUseCase,
  }),
  provideUseCase(FinalizeBatchNotificationUseCase, {
    cache: NotificationCachePort,
    notificationDedup: NotificationDedupPort,
    logger: loggerFor(FinalizeBatchNotificationUseCase),
  }),
  provideUseCase(SendBatchNotificationUseCase, {
    persistBatchNotificationUseCase: PersistBatchNotificationUseCase,
    finalizeBatchNotificationUseCase: FinalizeBatchNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    afterCommitTasks: AfterCommitTaskRegistryPort,
  }),
  provideUseCase(PublishNotificationUseCase, {
    sendNotification: SendNotificationUseCase,
    sendNotificationWithDeduplication: SendNotificationWithDedupUseCase,
    sendBatchNotification: SendBatchNotificationUseCase,
    todoTargetReader: NotificationTodoTargetReaderPort,
  }),
  provideUseCase(SendFollowRequestNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendFollowRequestNotificationUseCase),
  }),
  provideUseCase(SendFollowAcceptedNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendFollowAcceptedNotificationUseCase),
  }),
  provideUseCase(SendNudgeNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendNudgeNotificationUseCase),
  }),
  provideUseCase(SendCheerNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendCheerNotificationUseCase),
  }),
  provideUseCase(SendBillingIssueNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendBillingIssueNotificationUseCase),
  }),
  provideUseCase(SendMilestoneNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    notificationDedupLock: NotificationDedupLockPort,
    logger: loggerFor(SendMilestoneNotificationUseCase),
  }),
  provideUseCase(SendFriendCompletionNotificationsUseCase, {
    notificationHistoryReader: NotificationHistoryReader,
    persistBatch: PersistBatchNotificationUseCase,
    finalizeBatch: FinalizeBatchNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    userNotificationSettings: UserNotificationSettingsPort,
    clock: ClockPort,
    logger: loggerFor(SendFriendCompletionNotificationsUseCase),
  }),
  provideUseCase(ReportPushDeviceUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    pushProvider: PushProviderPort,
    userSettings: UserNotificationSettingsPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(ReportPushDeviceUseCase),
  }),
  provideUseCase(UnregisterPushDeviceUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    cache: NotificationCachePort,
    logger: loggerFor(UnregisterPushDeviceUseCase),
  }),
  provideUseCase(ReleaseSessionPushDevicesUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    cache: NotificationCachePort,
    logger: loggerFor(ReleaseSessionPushDevicesUseCase),
  }),
  { provide: SessionPushDeviceReleasePort, useExisting: ReleaseSessionPushDevicesUseCase },
  provideUseCase(OptOutMarketingPushUseCase, {
    tokens: MarketingPushOptOutTokenPort,
    settings: UserNotificationSettingsPort,
    clock: ClockPort,
    logger: loggerFor(OptOutMarketingPushUseCase),
  }),
  provideUseCase(ReconfirmMarketingConsentsUseCase, {
    reconfirmAccess: MarketingConsentReconfirmPort,
    localeReader: NotificationRecipientLocaleReaderPort,
    timezoneReader: NotificationRecipientTimezoneReaderPort,
    quietHoursReader: PushQuietHoursReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(ReconfirmMarketingConsentsUseCase),
  }),
] satisfies Provider[];

export const NOTIFICATION_PUSH_PROVIDERS = [
  ...NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_PUSH_EXTERNAL_PROVIDERS,
  ...NOTIFICATION_PUSH_USE_CASE_PROVIDERS,
] satisfies Provider[];

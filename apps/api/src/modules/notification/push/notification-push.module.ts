import { Module } from "@nestjs/common";
import type { Redis } from "ioredis";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";

import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import { NOTIFICATION_CACHE } from "../inbox/application/ports/notification-cache.port.js";
import { NOTIFICATION_HISTORY_READER } from "../inbox/application/ports/notification-history.reader.port.js";
import { NOTIFICATION_INBOX_READER } from "../inbox/application/ports/notification-inbox.reader.port.js";
import { NOTIFICATION_REPOSITORY } from "../inbox/application/ports/notification.repository.port.js";
import { NotificationAccountCleanup } from "../inbox/application/use-cases/delete-actor-notifications.use-case.js";
import { NotificationCacheAdapter } from "../inbox/infrastructure/cache/notification-cache.adapter.js";
import { DrizzleNotificationReader } from "../inbox/infrastructure/persistence/drizzle-notification.reader.js";
import { DrizzleNotificationRepository } from "../inbox/infrastructure/persistence/drizzle-notification.repository.js";
import { NotificationInboxController } from "../inbox/presentation/http/v1/notification-inbox.controller.js";
import { NotificationController } from "../inbox/presentation/http/v1/notification.controller.js";
import { ACTIVE_PUSH_TOKEN_READER } from "./application/ports/active-push-token.reader.port.js";
import { CLIENT_APP_VERSION_READER } from "./application/ports/client-app-version.reader.port.js";
import { MARKETING_CONSENT_RECONFIRM_ACCESS } from "./application/ports/marketing-consent-reconfirm.port.js";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/marketing-push-opt-out-token.port.js";
import {
  NOTIFICATION_DEDUP,
  NOTIFICATION_DEDUP_LOCK,
} from "./application/ports/notification-dedup.port.js";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "./application/ports/notification-recipient-locale.reader.port.js";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "./application/ports/notification-recipient-preference.reader.port.js";
import { NOTIFICATION_RECIPIENT_TIMEZONE_READER } from "./application/ports/notification-recipient-timezone.reader.port.js";
import { NOTIFICATION_TODO_TARGET_READER } from "./application/ports/notification-todo-target.reader.port.js";
import { PUSH_CAMPAIGN_OUTCOME_READER } from "./application/ports/push-campaign-outcome.reader.port.js";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "./application/ports/push-delivery-lifecycle.repository.port.js";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PUSH_DEVICE_REPOSITORY } from "./application/ports/push-device.repository.port.js";
import { PUSH_DISPATCH_STAGING } from "./application/ports/push-dispatch-staging.repository.port.js";
import { PUSH_PROVIDER } from "./application/ports/push-provider.port.js";
import { PUSH_QUIET_HOURS_READER } from "./application/ports/push-quiet-hours.reader.port.js";
import {
  PUSH_RATE_LIMITER,
  type PushRateLimiterPort,
} from "./application/ports/push-rate-limiter.port.js";
import { PUSH_RECEIPT_REPOSITORY } from "./application/ports/push-receipt.repository.port.js";
import { PUSH_TOKEN_REPOSITORY } from "./application/ports/push-token.repository.port.js";
import { SESSION_PUSH_DEVICE_RELEASE } from "./application/ports/session-push-device-release.port.js";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/user-notification-settings.port.js";
import { PushQuietHoursReader } from "./application/push-quiet-hours.reader.js";
import { NotificationPublisher } from "./application/use-cases/publish-notification.use-case.js";
import { ReleaseSessionPushDevices } from "./application/use-cases/release-session-push-devices.use-case.js";
import { CachedActivePushTokenReaderAdapter } from "./infrastructure/adapters/cached-active-push-token-reader.adapter.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/cached-notification-recipient-preference.adapter.js";
import { ExpoPushProvider } from "./infrastructure/adapters/expo-push-sender.adapter.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/adapters/hmac-marketing-push-opt-out-token.adapter.js";
import { NotificationDedupLockAdapter } from "./infrastructure/adapters/notification-dedup-lock.adapter.js";
import { NotificationDedupAdapter } from "./infrastructure/adapters/notification-dedup.adapter.js";
import { createPushRateLimiter } from "./infrastructure/adapters/push-rate-limiter-factory.adapter.js";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/user-notification-settings.adapter.js";
import { MarketingConsentReconfirmProcessor } from "./infrastructure/jobs/marketing-consent-reconfirm.processor.js";
import { MarketingConsentReconfirmJob } from "./infrastructure/jobs/marketing-consent-reconfirm.scheduler.js";
import { NotificationQueueModule } from "./infrastructure/jobs/notification-queue.module.js";
import { NotificationQueueProcessor } from "./infrastructure/jobs/notification-queue.processor.js";
import { PushDeliveryQueueService } from "./infrastructure/jobs/push-delivery-queue.adapter.js";
import { PushDeliveryQueueProcessor } from "./infrastructure/jobs/push-delivery-queue.processor.js";
import { DrizzleClientAppVersionReader } from "./infrastructure/persistence/drizzle-client-app-version.reader.js";
import { DrizzleNotificationTodoTargetReader } from "./infrastructure/persistence/drizzle-notification-todo-target.reader.js";
import { DrizzlePushCampaignOutcomeReader } from "./infrastructure/persistence/drizzle-push-campaign-outcome.reader.js";
import { DrizzlePushDeliveryLifecycleRepository } from "./infrastructure/persistence/drizzle-push-delivery-lifecycle.repository.js";
import { DrizzlePushDeliveryOutboxRepository } from "./infrastructure/persistence/drizzle-push-delivery-outbox.repository.js";
import { DrizzlePushDeviceRepository } from "./infrastructure/persistence/drizzle-push-device.repository.js";
import { DrizzlePushDispatchStagingRepository } from "./infrastructure/persistence/drizzle-push-dispatch-staging.repository.js";
import { DrizzlePushReceiptRepository } from "./infrastructure/persistence/drizzle-push-receipt.repository.js";
import { DrizzlePushTokenRepository } from "./infrastructure/persistence/drizzle-push-token.repository.js";
import {
  deliverPushNotificationsProvider,
  finalizeBatchNotificationProvider,
  notificationHistoryReaderProvider,
  notificationPublisherProvider,
  getNotificationsProvider,
  getUnreadCountProvider,
  markAllAsReadProvider,
  markAsReadProvider,
  markNotificationOpenedProvider,
  notificationAccountCleanupProvider,
  optOutMarketingPushProvider,
  persistBatchNotificationProvider,
  publishPushDeliveryOutboxProvider,
  pushDeliveryAfterCommitPublisherProvider,
  pushDeliveryEligibilityServiceProvider,
  pushQuietHoursReaderProvider,
  pushNotificationDeliveryServiceProvider,
  pushNotificationPayloadFactoryProvider,
  reconcilePushReceiptsProvider,
  recoverFailedPushDeliveriesProvider,
  releaseSessionPushDevicesProvider,
  reportPushDeviceProvider,
  relayPushDeliveryOutboxProvider,
  sendBatchNotificationProvider,
  sendBillingIssueNotificationProvider,
  sendCheerNotificationProvider,
  sendFollowAcceptedNotificationProvider,
  sendFollowRequestNotificationProvider,
  sendFriendCompletionNotificationsProvider,
  sendMilestoneNotificationProvider,
  sendNotificationProvider,
  sendNotificationWithDedupProvider,
  sendNudgeNotificationProvider,
  unregisterPushDeviceProvider,
  reconfirmMarketingConsentsProvider,
} from "./notification-push.providers.js";

@Module({
  // Identity 설정의 역방향 큐 참조는 jobs.public 경계로 분리한다.
  imports: [NotificationQueueModule, IdentitySettingsModule],
  controllers: [NotificationController, NotificationInboxController],
  providers: [
    // 크로스 모듈 호환 경계 + endpoint UseCase
    notificationPublisherProvider,
    getNotificationsProvider,
    getUnreadCountProvider,
    markAsReadProvider,
    markNotificationOpenedProvider,
    markAllAsReadProvider,
    releaseSessionPushDevicesProvider,
    { provide: SESSION_PUSH_DEVICE_RELEASE, useExisting: ReleaseSessionPushDevices },
    reportPushDeviceProvider,
    unregisterPushDeviceProvider,
    optOutMarketingPushProvider,
    sendNotificationProvider,
    sendNotificationWithDedupProvider,
    persistBatchNotificationProvider,
    finalizeBatchNotificationProvider,
    sendBatchNotificationProvider,
    notificationHistoryReaderProvider,
    sendFollowRequestNotificationProvider,
    sendFollowAcceptedNotificationProvider,
    sendNudgeNotificationProvider,
    sendCheerNotificationProvider,
    sendBillingIssueNotificationProvider,
    sendFriendCompletionNotificationsProvider,
    sendMilestoneNotificationProvider,
    reconcilePushReceiptsProvider,
    DrizzleNotificationRepository,
    { provide: NOTIFICATION_REPOSITORY, useExisting: DrizzleNotificationRepository },
    DrizzleNotificationReader,
    { provide: NOTIFICATION_INBOX_READER, useExisting: DrizzleNotificationReader },
    { provide: NOTIFICATION_HISTORY_READER, useExisting: DrizzleNotificationReader },
    DrizzleNotificationTodoTargetReader,
    { provide: NOTIFICATION_TODO_TARGET_READER, useExisting: DrizzleNotificationTodoTargetReader },
    DrizzlePushDeviceRepository,
    { provide: PUSH_DEVICE_REPOSITORY, useExisting: DrizzlePushDeviceRepository },
    DrizzlePushTokenRepository,
    { provide: PUSH_TOKEN_REPOSITORY, useExisting: DrizzlePushTokenRepository },
    DrizzlePushReceiptRepository,
    { provide: PUSH_RECEIPT_REPOSITORY, useExisting: DrizzlePushReceiptRepository },
    { provide: PUSH_CAMPAIGN_OUTCOME_READER, useClass: DrizzlePushCampaignOutcomeReader },
    DrizzlePushDispatchStagingRepository,
    { provide: PUSH_DISPATCH_STAGING, useExisting: DrizzlePushDispatchStagingRepository },
    DrizzlePushDeliveryOutboxRepository,
    {
      provide: PUSH_DELIVERY_OUTBOX_REPOSITORY,
      useExisting: DrizzlePushDeliveryOutboxRepository,
    },
    DrizzlePushDeliveryLifecycleRepository,
    {
      provide: PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      useExisting: DrizzlePushDeliveryLifecycleRepository,
    },
    notificationAccountCleanupProvider,
    HmacMarketingPushOptOutTokenAdapter,
    {
      provide: MARKETING_PUSH_OPT_OUT_TOKEN,
      useExisting: HmacMarketingPushOptOutTokenAdapter,
    },
    // user-settings의 공개 알림 설정 capability에 연결하는 ACL 어댑터
    UserNotificationSettingsAdapter,
    { provide: USER_NOTIFICATION_SETTINGS, useExisting: UserNotificationSettingsAdapter },
    { provide: MARKETING_CONSENT_RECONFIRM_ACCESS, useExisting: UserNotificationSettingsAdapter },
    reconfirmMarketingConsentsProvider,
    MarketingConsentReconfirmJob,
    MarketingConsentReconfirmProcessor,
    // 조회 캐시 포트 (application → CacheService 직접 의존 역전)
    { provide: NOTIFICATION_CACHE, useClass: NotificationCacheAdapter },
    NotificationDedupAdapter,
    {
      provide: NOTIFICATION_DEDUP,
      useExisting: NotificationDedupAdapter,
    },
    {
      provide: NOTIFICATION_DEDUP_LOCK,
      useClass: NotificationDedupLockAdapter,
    },
    // 캐시를 포함한 수신자 조회 capability
    CachedActivePushTokenReaderAdapter,
    {
      provide: ACTIVE_PUSH_TOKEN_READER,
      useExisting: CachedActivePushTokenReaderAdapter,
    },
    CachedNotificationRecipientPreferenceAdapter,
    {
      provide: NOTIFICATION_RECIPIENT_PREFERENCE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    {
      provide: NOTIFICATION_RECIPIENT_LOCALE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    {
      provide: NOTIFICATION_RECIPIENT_TIMEZONE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    { provide: CLIENT_APP_VERSION_READER, useClass: DrizzleClientAppVersionReader },
    // application 전달 정책 + durable outbox/queue 경계
    pushDeliveryAfterCommitPublisherProvider,
    pushDeliveryEligibilityServiceProvider,
    pushQuietHoursReaderProvider,
    { provide: PUSH_QUIET_HOURS_READER, useExisting: PushQuietHoursReader },
    pushNotificationDeliveryServiceProvider,
    pushNotificationPayloadFactoryProvider,
    deliverPushNotificationsProvider,
    publishPushDeliveryOutboxProvider,
    recoverFailedPushDeliveriesProvider,
    relayPushDeliveryOutboxProvider,
    PushDeliveryQueueService,
    { provide: PUSH_DELIVERY_JOB_ENQUEUER, useExisting: PushDeliveryQueueService },
    PushDeliveryQueueProcessor,
    // Push Provider (Strategy Pattern — Expo, 향후 FCM/APNs)
    {
      provide: PUSH_PROVIDER,
      useClass: ExpoPushProvider,
    },
    // Push Rate Limiter (Strategy Pattern)
    {
      provide: PUSH_RATE_LIMITER,
      useFactory: (
        configService: TypedConfigService,
        database: Database,
        redis?: Redis,
      ): PushRateLimiterPort => {
        return createPushRateLimiter({
          backend: configService.pushRateLimitBackend,
          database,
          ...(redis && { redis }),
        });
      },
      inject: [TypedConfigService, DRIZZLE, { token: REDIS_COMMAND_CLIENT, optional: true }],
    },
    NotificationQueueProcessor,
  ],
  exports: [
    NOTIFICATION_CACHE,
    NotificationPublisher,
    NotificationHistoryReader,
    NOTIFICATION_RECIPIENT_LOCALE_READER,
    NOTIFICATION_RECIPIENT_TIMEZONE_READER,
    CLIENT_APP_VERSION_READER,
    PUSH_QUIET_HOURS_READER,
    NotificationAccountCleanup,
    NotificationQueueModule,
    PUSH_CAMPAIGN_OUTCOME_READER,
    SESSION_PUSH_DEVICE_RELEASE,
  ],
})
export class NotificationDeliveryModule {}

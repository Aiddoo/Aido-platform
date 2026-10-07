import { Module } from "@nestjs/common";
import type { Redis } from "ioredis";

import { UserSettingsModule } from "#api/modules/identity/identity-settings.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DatabaseService } from "#api/platform/database/database.service";
import { REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";

import { ACTIVE_PUSH_TOKEN_READER } from "./application/ports/delivery/active-push-token.reader.port.js";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/delivery/marketing-push-opt-out-token.port.js";
import { NOTIFICATION_CACHE } from "./application/ports/delivery/notification-cache.port.js";
import {
  NOTIFICATION_DEDUP,
  NOTIFICATION_DEDUP_LOCK,
} from "./application/ports/delivery/notification-dedup.port.js";
import { NOTIFICATION_HISTORY_READER } from "./application/ports/delivery/notification-history.reader.port.js";
import { NOTIFICATION_INBOX_READER } from "./application/ports/delivery/notification-inbox.reader.port.js";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "./application/ports/delivery/notification-recipient-locale.reader.port.js";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "./application/ports/delivery/notification-recipient-preference.reader.port.js";
import { NOTIFICATION_REPOSITORY } from "./application/ports/delivery/notification.repository.port.js";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "./application/ports/delivery/push-delivery-job-enqueuer.port.js";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "./application/ports/delivery/push-delivery-lifecycle.repository.port.js";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "./application/ports/delivery/push-delivery-outbox.repository.port.js";
import { PUSH_DISPATCH_STAGING } from "./application/ports/delivery/push-dispatch-staging.repository.port.js";
import { PUSH_PROVIDER } from "./application/ports/delivery/push-provider.port.js";
import {
  PUSH_RATE_LIMITER,
  type PushRateLimiterPort,
} from "./application/ports/delivery/push-rate-limiter.port.js";
import { PUSH_RECEIPT_REPOSITORY } from "./application/ports/delivery/push-receipt.repository.port.js";
import { PUSH_TOKEN_REPOSITORY } from "./application/ports/delivery/push-token.repository.port.js";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/delivery/user-notification-settings.port.js";
import { NotificationPublisher } from "./application/publishers/delivery/notification.publisher.js";
import { NotificationHistoryReader } from "./application/readers/delivery/notification-history.reader.js";
import { NotificationAccountCleanup } from "./application/services/delivery/notification-account-cleanup.js";
import { CachedActivePushTokenReaderAdapter } from "./infrastructure/adapters/delivery/cached-active-push-token-reader.adapter.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/delivery/cached-notification-recipient-preference.adapter.js";
import { NotificationCacheAdapter } from "./infrastructure/adapters/delivery/notification-cache.adapter.js";
import { NotificationDedupLockAdapter } from "./infrastructure/adapters/delivery/notification-dedup-lock.adapter.js";
import { NotificationDedupAdapter } from "./infrastructure/adapters/delivery/notification-dedup.adapter.js";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/delivery/user-notification-settings.adapter.js";
import { NotificationQueueModule } from "./infrastructure/jobs/delivery/notification-queue.module.js";
import { NotificationQueueProcessor } from "./infrastructure/jobs/delivery/notification-queue.processor.js";
import { PushDeliveryQueueProcessor } from "./infrastructure/jobs/delivery/push-delivery-queue.processor.js";
import { PushDeliveryQueueService } from "./infrastructure/jobs/delivery/push-delivery-queue.service.js";
import { PrismaNotificationReader } from "./infrastructure/persistence/delivery/prisma-notification.reader.js";
import { PrismaNotificationRepository } from "./infrastructure/persistence/delivery/prisma-notification.repository.js";
import { PrismaPushDeliveryLifecycleRepository } from "./infrastructure/persistence/delivery/prisma-push-delivery-lifecycle.repository.js";
import { PrismaPushDeliveryOutboxRepository } from "./infrastructure/persistence/delivery/prisma-push-delivery-outbox.repository.js";
import { PrismaPushDispatchStagingRepository } from "./infrastructure/persistence/delivery/prisma-push-dispatch-staging.repository.js";
import { PrismaPushReceiptRepository } from "./infrastructure/persistence/delivery/prisma-push-receipt.repository.js";
import { PrismaPushTokenRepository } from "./infrastructure/persistence/delivery/prisma-push-token.repository.js";
import { ExpoPushProvider } from "./infrastructure/providers/delivery/expo-push.provider.js";
import { createPushRateLimiter } from "./infrastructure/rate-limiter/delivery/push-rate-limiter.factory.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/security/delivery/hmac-marketing-push-opt-out-token.adapter.js";
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
  pushNotificationDeliveryServiceProvider,
  pushNotificationPayloadFactoryProvider,
  reconcilePushReceiptsProvider,
  recoverFailedPushDeliveriesProvider,
  registerPushTokenProvider,
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
  unregisterPushTokenProvider,
} from "./notification-delivery-application.providers.js";
import { NotificationInboxController } from "./presentation/controllers/delivery/notification-inbox.controller.js";
import { NotificationController } from "./presentation/controllers/delivery/notification.controller.js";

@Module({
  // Identity 설정의 역방향 큐 참조는 jobs.public 경계로 분리한다.
  imports: [NotificationQueueModule, UserSettingsModule],
  controllers: [NotificationController, NotificationInboxController],
  providers: [
    // 크로스 모듈 호환 경계 + endpoint UseCase
    notificationPublisherProvider,
    getNotificationsProvider,
    getUnreadCountProvider,
    markAsReadProvider,
    markNotificationOpenedProvider,
    markAllAsReadProvider,
    registerPushTokenProvider,
    unregisterPushTokenProvider,
    optOutMarketingPushProvider,
    // 크로스모듈 발송/디스패치 use-cases
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
    // 책임별 persistence 포트 바인딩
    PrismaNotificationRepository,
    { provide: NOTIFICATION_REPOSITORY, useExisting: PrismaNotificationRepository },
    PrismaNotificationReader,
    { provide: NOTIFICATION_INBOX_READER, useExisting: PrismaNotificationReader },
    { provide: NOTIFICATION_HISTORY_READER, useExisting: PrismaNotificationReader },
    PrismaPushTokenRepository,
    { provide: PUSH_TOKEN_REPOSITORY, useExisting: PrismaPushTokenRepository },
    PrismaPushReceiptRepository,
    { provide: PUSH_RECEIPT_REPOSITORY, useExisting: PrismaPushReceiptRepository },
    PrismaPushDispatchStagingRepository,
    { provide: PUSH_DISPATCH_STAGING, useExisting: PrismaPushDispatchStagingRepository },
    PrismaPushDeliveryOutboxRepository,
    {
      provide: PUSH_DELIVERY_OUTBOX_REPOSITORY,
      useExisting: PrismaPushDeliveryOutboxRepository,
    },
    PrismaPushDeliveryLifecycleRepository,
    {
      provide: PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      useExisting: PrismaPushDeliveryLifecycleRepository,
    },
    notificationAccountCleanupProvider,
    HmacMarketingPushOptOutTokenAdapter,
    {
      provide: MARKETING_PUSH_OPT_OUT_TOKEN,
      useExisting: HmacMarketingPushOptOutTokenAdapter,
    },
    // user-settings의 공개 알림 설정 capability에 연결하는 ACL 어댑터
    {
      provide: USER_NOTIFICATION_SETTINGS,
      useClass: UserNotificationSettingsAdapter,
    },
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
    // application 전달 정책 + durable outbox/queue 경계
    pushDeliveryAfterCommitPublisherProvider,
    pushDeliveryEligibilityServiceProvider,
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
        database: DatabaseService,
        redis?: Redis,
      ): PushRateLimiterPort => {
        return createPushRateLimiter({
          backend: configService.pushRateLimitBackend,
          database,
          ...(redis && { redis }),
        });
      },
      inject: [
        TypedConfigService,
        DatabaseService,
        { token: REDIS_COMMAND_CLIENT, optional: true },
      ],
    },
    // 알림 큐 프로세서
    NotificationQueueProcessor,
  ],
  exports: [
    NOTIFICATION_CACHE,
    NotificationPublisher,
    NotificationHistoryReader,
    NOTIFICATION_RECIPIENT_LOCALE_READER,
    NotificationAccountCleanup,
    NotificationQueueModule,
    PUSH_PROVIDER,
    PUSH_RATE_LIMITER,
    MARKETING_PUSH_OPT_OUT_TOKEN,
  ],
})
export class NotificationDeliveryModule {}

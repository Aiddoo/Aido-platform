import { Module } from "@nestjs/common";
import type { Redis } from "ioredis";

import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { REDIS_COMMAND_CLIENT } from "#api/shared/infrastructure/redis/redis.constants";
import { UserSettingsModule } from "#api/user-settings/user-settings.module";

import { ACTIVE_PUSH_TOKEN_READER } from "./application/ports/active-push-token.reader.port.js";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/marketing-push-opt-out-token.port.js";
import { NOTIFICATION_CACHE } from "./application/ports/notification-cache.port.js";
import {
	NOTIFICATION_DEDUP,
	NOTIFICATION_DEDUP_LOCK,
} from "./application/ports/notification-dedup.port.js";
import { NOTIFICATION_HISTORY_READER } from "./application/ports/notification-history.reader.port.js";
import { NOTIFICATION_INBOX_READER } from "./application/ports/notification-inbox.reader.port.js";
import {
	NOTIFICATION_RECIPIENT_LOCALE_READER,
	type NotificationRecipientLocaleReaderPort,
} from "./application/ports/notification-recipient-locale.reader.port.js";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "./application/ports/notification-recipient-preference.reader.port.js";
import { NOTIFICATION_REPOSITORY } from "./application/ports/notification.repository.port.js";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "./application/ports/push-delivery-lifecycle.repository.port.js";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PUSH_DISPATCH_STAGING } from "./application/ports/push-dispatch-staging.repository.port.js";
import { PUSH_PROVIDER } from "./application/ports/push-provider.port.js";
import {
	PUSH_RATE_LIMITER,
	type PushRateLimiterPort,
} from "./application/ports/push-rate-limiter.port.js";
import { PUSH_RECEIPT_REPOSITORY } from "./application/ports/push-receipt.repository.port.js";
import { PUSH_TOKEN_REPOSITORY } from "./application/ports/push-token.repository.port.js";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/user-notification-settings.port.js";
import { NotificationPublisher } from "./application/publishers/notification.publisher.js";
import { NotificationHistoryReader } from "./application/readers/notification-history.reader.js";
import { NotificationRecipientLocaleReader } from "./application/readers/notification-recipient-locale.reader.js";
import { NotificationAccountCleanup } from "./application/services/notification-account-cleanup.js";
import { PushDeliveryAfterCommitPublisher } from "./application/services/push-delivery-after-commit.publisher.js";
import { PushDeliveryEligibilityService } from "./application/services/push-delivery-eligibility.service.js";
import { PushNotificationDeliveryService } from "./application/services/push-notification-delivery.service.js";
import { PushNotificationPayloadFactory } from "./application/services/push-notification-payload.factory.js";
import { DeliverPushNotificationsUseCase } from "./application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case.js";
import { FinalizeBatchNotificationUseCase } from "./application/use-cases/finalize-batch-notification/finalize-batch-notification.use-case.js";
import { FindAlreadyNotifiedUsersUseCase } from "./application/use-cases/find-already-notified-users/find-already-notified-users.use-case.js";
import { GetNotificationsUseCase } from "./application/use-cases/get-notifications/get-notifications.use-case.js";
import { GetUnreadCountUseCase } from "./application/use-cases/get-unread-count/get-unread-count.use-case.js";
import { MarkAllAsReadUseCase } from "./application/use-cases/mark-all-as-read/mark-all-as-read.use-case.js";
import { MarkAsReadUseCase } from "./application/use-cases/mark-as-read/mark-as-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "./application/use-cases/mark-notification-opened/mark-notification-opened.use-case.js";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case.js";
import { PersistBatchNotificationUseCase } from "./application/use-cases/persist-batch-notification/persist-batch-notification.use-case.js";
import { PublishPushDeliveryOutboxUseCase } from "./application/use-cases/publish-push-delivery-outbox/publish-push-delivery-outbox.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts/reconcile-push-receipts.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "./application/use-cases/recover-failed-push-deliveries/recover-failed-push-deliveries.use-case.js";
import { RegisterPushTokenUseCase } from "./application/use-cases/register-push-token/register-push-token.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./application/use-cases/relay-push-delivery-outbox/relay-push-delivery-outbox.use-case.js";
import { SendBatchNotificationUseCase } from "./application/use-cases/send-batch-notification/send-batch-notification.use-case.js";
import { SendBillingIssueNotificationUseCase } from "./application/use-cases/send-billing-issue-notification/send-billing-issue-notification.use-case.js";
import { SendCheerNotificationUseCase } from "./application/use-cases/send-cheer-notification/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotificationUseCase } from "./application/use-cases/send-follow-accepted-notification/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotificationUseCase } from "./application/use-cases/send-follow-request-notification/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "./application/use-cases/send-friend-completion-notifications/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotificationUseCase } from "./application/use-cases/send-milestone-notification/send-milestone-notification.use-case.js";
import { SendNotificationWithDedupUseCase } from "./application/use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case.js";
import { SendNotificationUseCase } from "./application/use-cases/send-notification/send-notification.use-case.js";
import { SendNudgeNotificationUseCase } from "./application/use-cases/send-nudge-notification/send-nudge-notification.use-case.js";
import { UnregisterPushTokenUseCase } from "./application/use-cases/unregister-push-token/unregister-push-token.use-case.js";
import { CachedActivePushTokenReaderAdapter } from "./infrastructure/adapters/cached-active-push-token-reader.adapter.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/cached-notification-recipient-preference.adapter.js";
import { NotificationCacheAdapter } from "./infrastructure/adapters/notification-cache.adapter.js";
import { NotificationDedupLockAdapter } from "./infrastructure/adapters/notification-dedup-lock.adapter.js";
import { NotificationDedupAdapter } from "./infrastructure/adapters/notification-dedup.adapter.js";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/user-notification-settings.adapter.js";
import { PrismaNotificationReader } from "./infrastructure/persistence/prisma-notification.reader.js";
import { PrismaNotificationRepository } from "./infrastructure/persistence/prisma-notification.repository.js";
import { PrismaPushDeliveryLifecycleRepository } from "./infrastructure/persistence/prisma-push-delivery-lifecycle.repository.js";
import { PrismaPushDeliveryOutboxRepository } from "./infrastructure/persistence/prisma-push-delivery-outbox.repository.js";
import { PrismaPushDispatchStagingRepository } from "./infrastructure/persistence/prisma-push-dispatch-staging.repository.js";
import { PrismaPushReceiptRepository } from "./infrastructure/persistence/prisma-push-receipt.repository.js";
import { PrismaPushTokenRepository } from "./infrastructure/persistence/prisma-push-token.repository.js";
import { ExpoPushProvider } from "./infrastructure/providers/expo-push.provider.js";
import { NotificationQueueModule } from "./infrastructure/queue/notification-queue.module.js";
import { NotificationQueueProcessor } from "./infrastructure/queue/notification-queue.processor.js";
import { PushDeliveryQueueProcessor } from "./infrastructure/queue/push-delivery-queue.processor.js";
import { PushDeliveryQueueService } from "./infrastructure/queue/push-delivery-queue.service.js";
import { createPushRateLimiter } from "./infrastructure/rate-limiter/push-rate-limiter.factory.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/security/hmac-marketing-push-opt-out-token.adapter.js";
import { NotificationController } from "./presentation/notification.controller.js";

/**
 * Notification 모듈 (클린아키텍처 4계층 + 포트/어댑터)
 *
 * - presentation: NotificationController → endpoint UseCase
 * - application: 조회·읽음·토큰·발송 UseCase
 * - infrastructure: Prisma outbox 저장소·Expo provider·rate limiter·durable queue processor
 *
 * Provider 추상화(PUSH_PROVIDER 포트)로 Expo → FCM/APNs 교체를 어댑터 추가만으로 대비.
 */
@Module({
	// notification → user-settings 단방향 DI(푸시 발송 전 사용자 설정 조회).
	// 역방향(user-settings → notification)은 경량 `@/notification/queue` 서브엔트리로만
	// 참조하므로 ES 초기화 순환이 없다 → forwardRef 불필요.
	imports: [NotificationQueueModule, UserSettingsModule],
	controllers: [NotificationController],
	providers: [
		// 크로스 모듈 호환 경계 + endpoint UseCase
		{
			provide: NotificationPublisher,
			inject: [
				SendNotificationUseCase,
				SendNotificationWithDedupUseCase,
				SendBatchNotificationUseCase,
			],
			useFactory: (
				sendNotification: SendNotificationUseCase,
				sendNotificationWithDeduplication: SendNotificationWithDedupUseCase,
				sendBatchNotification: SendBatchNotificationUseCase,
			) =>
				new NotificationPublisher(
					sendNotification,
					sendNotificationWithDeduplication,
					sendBatchNotification,
				),
		},
		{
			provide: NotificationHistoryReader,
			inject: [FindAlreadyNotifiedUsersUseCase],
			useFactory: (findAlreadyNotifiedUsers: FindAlreadyNotifiedUsersUseCase) =>
				new NotificationHistoryReader(findAlreadyNotifiedUsers),
		},
		{
			provide: NotificationRecipientLocaleReader,
			inject: [NOTIFICATION_RECIPIENT_LOCALE_READER],
			useFactory: (localeReader: NotificationRecipientLocaleReaderPort) =>
				new NotificationRecipientLocaleReader(localeReader),
		},
		GetNotificationsUseCase,
		GetUnreadCountUseCase,
		MarkAsReadUseCase,
		MarkNotificationOpenedUseCase,
		MarkAllAsReadUseCase,
		RegisterPushTokenUseCase,
		UnregisterPushTokenUseCase,
		OptOutMarketingPushUseCase,
		// 크로스모듈 발송/디스패치 use-cases
		SendNotificationUseCase,
		SendNotificationWithDedupUseCase,
		PersistBatchNotificationUseCase,
		FinalizeBatchNotificationUseCase,
		SendBatchNotificationUseCase,
		FindAlreadyNotifiedUsersUseCase,
		SendFollowRequestNotificationUseCase,
		SendFollowAcceptedNotificationUseCase,
		SendNudgeNotificationUseCase,
		SendCheerNotificationUseCase,
		SendBillingIssueNotificationUseCase,
		SendFriendCompletionNotificationsUseCase,
		SendMilestoneNotificationUseCase,
		ReconcilePushReceiptsUseCase,
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
		NotificationAccountCleanup,
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
		PushDeliveryAfterCommitPublisher,
		PushDeliveryEligibilityService,
		PushNotificationDeliveryService,
		PushNotificationPayloadFactory,
		DeliverPushNotificationsUseCase,
		PublishPushDeliveryOutboxUseCase,
		RecoverFailedPushDeliveriesUseCase,
		RelayPushDeliveryOutboxUseCase,
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
		NotificationPublisher,
		NotificationHistoryReader,
		NotificationRecipientLocaleReader,
		NotificationAccountCleanup,
		NotificationQueueModule,
		PUSH_PROVIDER,
		PUSH_RATE_LIMITER,
		MARKETING_PUSH_OPT_OUT_TOKEN,
	],
})
export class NotificationModule {}

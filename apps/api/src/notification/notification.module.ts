import { Module } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { REDIS_COMMAND_CLIENT } from "@/shared/infrastructure/redis/redis.constants";
import { UserSettingsModule } from "@/user-settings/user-settings.module";

import { NotificationFacade } from "./application/facades/notification.facade";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/marketing-push-opt-out-token.port";
import { NOTIFICATION_REPOSITORY } from "./application/ports/notification.repository.port";
import { NOTIFICATION_CACHE } from "./application/ports/notification-cache.port";
import { NOTIFICATION_DEDUP } from "./application/ports/notification-dedup.port";
import { PUSH_DISPATCHER } from "./application/ports/push-dispatcher.port";
import { PUSH_PROVIDER } from "./application/ports/push-provider.port";
import {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
} from "./application/ports/push-rate-limiter.port";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/user-notification-settings.port";
import { DispatchBatchNotificationUseCase } from "./application/use-cases/dispatch-batch-notification/dispatch-batch-notification.use-case";
import { FindAlreadyNotifiedUsersUseCase } from "./application/use-cases/find-already-notified-users/find-already-notified-users.use-case";
import { GetNotificationsUseCase } from "./application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "./application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "./application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "./application/use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "./application/use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { PersistBatchNotificationUseCase } from "./application/use-cases/persist-batch-notification/persist-batch-notification.use-case";
import { RegisterPushTokenUseCase } from "./application/use-cases/register-push-token/register-push-token.use-case";
import { SendBatchNotificationUseCase } from "./application/use-cases/send-batch-notification/send-batch-notification.use-case";
import { SendNotificationUseCase } from "./application/use-cases/send-notification/send-notification.use-case";
import { SendNotificationWithDedupUseCase } from "./application/use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import { UnregisterPushTokenUseCase } from "./application/use-cases/unregister-push-token/unregister-push-token.use-case";
import { NotificationCacheAdapter } from "./infrastructure/adapters/notification-cache.adapter";
import { NotificationDedupAdapter } from "./infrastructure/adapters/notification-dedup.adapter";
import { PushDispatcherAdapter } from "./infrastructure/adapters/push-dispatcher.adapter";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/user-notification-settings.adapter";
import { NotificationRepository } from "./infrastructure/persistence/notification.repository";
import { ExpoPushProvider } from "./infrastructure/providers/expo-push.provider";
import { NotificationQueueModule } from "./infrastructure/queue/notification-queue.module";
import { NotificationQueueProcessor } from "./infrastructure/queue/notification-queue.processor";
import { InMemoryPushRateLimiter } from "./infrastructure/rate-limiter/in-memory-push-rate-limiter";
import { RedisPushRateLimiter } from "./infrastructure/rate-limiter/redis-push-rate-limiter";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/security/hmac-marketing-push-opt-out-token.adapter";
import { NotificationController } from "./presentation/notification.controller";

/**
 * Notification 모듈 (클린아키텍처 4계층 + 포트/어댑터)
 *
 * - presentation: NotificationController → NotificationFacade(유스케이스 조합)
 * - application: 조회·읽음·토큰·발송 유스케이스 + NotificationFacade
 * - infrastructure: Prisma 저장소·Expo 푸시 프로바이더·PushDispatcher·rate limiter·BullMQ 프로세서
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
		// Facade + Use-cases (presentation 진입점)
		NotificationFacade,
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
		DispatchBatchNotificationUseCase,
		SendBatchNotificationUseCase,
		FindAlreadyNotifiedUsersUseCase,
		// Repository (포트 바인딩)
		NotificationRepository,
		{ provide: NOTIFICATION_REPOSITORY, useExisting: NotificationRepository },
		HmacMarketingPushOptOutTokenAdapter,
		{
			provide: MARKETING_PUSH_OPT_OUT_TOKEN,
			useExisting: HmacMarketingPushOptOutTokenAdapter,
		},
		// 사용자 설정 접근 (UserSettingsFacade 위임 어댑터)
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
		// 푸시 디스패처 (전송 메커니즘 + 발송 자격 판단)
		{ provide: PUSH_DISPATCHER, useClass: PushDispatcherAdapter },
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
				redis?: Redis,
			): IPushRateLimiter => {
				if (configService.cache.type === "redis" && redis) {
					return new RedisPushRateLimiter(redis);
				}
				return new InMemoryPushRateLimiter();
			},
			inject: [
				TypedConfigService,
				{ token: REDIS_COMMAND_CLIENT, optional: true },
			],
		},
		// BullMQ Queue Processor
		NotificationQueueProcessor,
	],
	exports: [
		NotificationFacade,
		NotificationRepository,
		NotificationQueueModule,
		PUSH_PROVIDER,
		PUSH_RATE_LIMITER,
		MARKETING_PUSH_OPT_OUT_TOKEN,
	],
})
export class NotificationModule {}

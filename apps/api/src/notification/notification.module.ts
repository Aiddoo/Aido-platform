import { Module } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { REDIS_COMMAND_CLIENT } from "@/shared/infrastructure/redis/redis.constants";
import { UserSettingsModule } from "@/user-settings/user-settings.module";

import { NotificationController } from "./notification.controller";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { ExpoPushProvider } from "./providers/expo-push.provider";
import { PUSH_PROVIDER } from "./providers/push-provider.interface";
import { PushDeliveryService } from "./push-delivery.service";
import { NotificationQueueModule } from "./queue/notification-queue.module";
import { NotificationQueueProcessor } from "./queue/notification-queue.processor";
import {
	InMemoryPushRateLimiter,
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
	RedisPushRateLimiter,
} from "./rate-limiter";

/**
 * Notification 모듈
 *
 * 푸시 알림 및 인앱 알림 관리 기능을 담당합니다.
 *
 * 서비스 구조:
 * - NotificationService: 알림 CRUD, 조회, 중복 방지
 * - PushDeliveryService: 푸시 토큰 관리, 발송, 필터링, Graceful Shutdown
 *
 * BullMQ 큐 기반 알림 처리:
 * - NotificationQueueService: 각 모듈에서 호출하여 알림 잡 등록
 * - NotificationQueueProcessor: 큐 잡 처리 (팔로우, 콕 찌르기, 응원, 결제 알림)
 *
 * Provider 추상화를 통해 Expo Push → FCM 마이그레이션 대비
 */
@Module({
	imports: [NotificationQueueModule, UserSettingsModule],
	controllers: [NotificationController],
	providers: [
		// Core
		NotificationRepository,
		NotificationService,
		PushDeliveryService,
		// Push Provider (Strategy Pattern)
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
	exports: [NotificationService, PushDeliveryService, NotificationQueueModule],
})
export class NotificationModule {}

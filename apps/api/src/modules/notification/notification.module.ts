import { Module } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "@/common/config/services/config.service";
import { REDIS_CLIENT } from "@/common/redis/redis.constants";
import { UserSettingsModule } from "@/modules/user-settings/user-settings.module";

import {
	CheerListener,
	FollowListener,
	NudgeListener,
	TodoListener,
} from "./listeners";
import { NotificationController } from "./notification.controller";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { ExpoPushProvider } from "./providers/expo-push.provider";
import { PUSH_PROVIDER } from "./providers/push-provider.interface";
import { PushDeliveryService } from "./push-delivery.service";
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
 * Event-driven 아키텍처:
 * - FollowListener: 팔로우 요청/수락 알림
 * - TodoListener: 할일 완료/리마인더 알림
 * - NudgeListener: 콕 찌르기 수신 알림
 * - CheerListener: 응원 수신 알림
 *
 * Provider 추상화를 통해 Expo Push → FCM 마이그레이션 대비
 */
@Module({
	imports: [UserSettingsModule],
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
			inject: [TypedConfigService, { token: REDIS_CLIENT, optional: true }],
		},
		// Event Listeners
		FollowListener,
		TodoListener,
		NudgeListener,
		CheerListener,
	],
	exports: [NotificationService],
})
export class NotificationModule {}

import { Module } from "@nestjs/common";

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

/**
 * Notification 모듈
 *
 * 푸시 알림 및 인앱 알림 관리 기능을 담당합니다.
 * - 푸시 토큰 등록/해제
 * - 알림 생성 및 푸시 발송
 * - 알림 목록 조회 (커서 기반 페이지네이션)
 * - 읽음 처리 (단일/전체)
 *
 * Event-driven 아키텍처:
 * - FollowListener: 팔로우 요청/수락 알림
 * - TodoListener: 할일 완료/리마인더 알림
 * - NudgeListener: 독촉 수신 알림
 * - CheerListener: 응원 수신 알림
 *
 * Provider 추상화를 통해 Expo Push → FCM 마이그레이션 대비
 */
@Module({
	controllers: [NotificationController],
	providers: [
		// Core
		NotificationRepository,
		NotificationService,
		// Push Provider (Strategy Pattern)
		{
			provide: PUSH_PROVIDER,
			useClass: ExpoPushProvider,
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

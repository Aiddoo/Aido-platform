/**
 * Notification 모듈 공개 배럴 (클린아키텍처 경계).
 *
 * 외부 모듈은 이 배럴만 임포트한다 (내부 레이어 딥 임포트 금지 — check-boundaries).
 */

// --- Facade (presentation 진입점) ---
export { NotificationFacade } from "./application/facades/notification.facade";
export {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "./application/ports/notification.repository.port";
// --- Data contracts ---
export type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	NotificationAction,
	NotificationMetadataInput,
	NotificationWithRelations,
	PushTokenWithRelations,
	RegisterPushTokenData,
} from "./application/ports/notification-data";
// --- Ports (푸시 프로바이더/rate limiter 추상화) ---
export {
	type BatchPushResult,
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
	type PushReceiptResult,
	type PushResult,
} from "./application/ports/push-provider.port";
export {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
} from "./application/ports/push-rate-limiter.port";
// --- Locale helpers (스케줄러 전략의 로케일별 메시지 조립) ---
export {
	createLocaleMessageCache,
	fetchUserLocales,
} from "./application/utils/user-locale.util";
// --- Templates (메시지 빌더 + 로케일 해석) ---
export * from "./domain/services/templates/notification-templates";
export type { NotificationType } from "./domain/types/notification-type";
// --- Repository (미이관 소비자 전이용 concrete + 포트 토큰) ---
export { NotificationRepository } from "./infrastructure/persistence/notification.repository";
// --- Queue constants + job data ---
export * from "./infrastructure/queue/notification-queue.constants";
export { NotificationQueueModule } from "./infrastructure/queue/notification-queue.module";
export { NotificationQueueProcessor } from "./infrastructure/queue/notification-queue.processor";
export { NotificationQueueService } from "./infrastructure/queue/notification-queue.service";
// --- Module wiring ---
export * from "./notification.module";

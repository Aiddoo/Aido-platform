/**
 * Notification 모듈 공개 배럴 (클린아키텍처 경계).
 *
 * 외부 모듈은 이 배럴만 임포트한다 (내부 레이어 딥 임포트 금지 — check-boundaries).
 */

export {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "./application/ports/marketing-push-opt-out-token.port";
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
// --- Cross-module notification capability ---
export { NotificationSender } from "./application/senders/notification.sender";
// --- Locale helpers (스케줄러 전략의 로케일별 메시지 조립) ---
export {
	createLocaleMessageCache,
	fetchUserLocales,
} from "./application/utils/user-locale.util";
// --- Templates (메시지 빌더 + 로케일 해석) ---
export * from "./domain/services/templates/notification-templates";
export type { NotificationType } from "./domain/types/notification-type";
// Prisma repository is internal to NotificationModule.
// Cross-module consumers use the public capability boundary above.
// --- Module wiring ---
export * from "./notification.module";

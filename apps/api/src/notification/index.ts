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
export type { CreateNotificationData } from "./application/ports/notification-data";
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
	PUSH_RATE_LIMITER,
	type PushRateLimiterPort,
} from "./application/ports/push-rate-limiter.port";
// --- Cross-module notification capability ---
export { NotificationSender } from "./application/senders/notification.sender";
export { NotificationAccountCleanup } from "./application/services/notification-account-cleanup";
export { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "./domain/services/transactional-notification-campaign";
// --- Type-safe notification copy factories consumed across feature boundaries ---
export {
	createAiSuggestionNotificationMessage,
	createEveningReminderNotificationMessage,
	createLunchNudgeNotificationMessage,
	createMonthlyReportNotificationMessage,
	createMorningNoTodoNotificationMessage,
	createMorningReminderNotificationMessage,
	createNudgeSuggestionNotificationMessage,
	createOnboardingNotificationMessage,
	createRetentionNotificationMessage,
	createSocialDigestNotificationMessage,
	createStreakAtRiskNotificationMessage,
	createTodoCommentNotificationMessage,
	createTodoReminderNotificationMessage,
	createWeatherEveningFallbackNotificationMessage,
	createWeatherEveningNotificationMessage,
	createWeatherMorningFallbackNotificationMessage,
	createWeatherMorningNotificationMessage,
	createWeeklyAchievementNotificationMessage,
	createWeeklyReportNotificationMessage,
	createWinbackNotificationMessage,
} from "./domain/services/templates/notification-templates";
export type { RetentionNotificationCopySelection } from "./domain/services/templates/notification-copy.types";
// Prisma repository is internal to NotificationModule.
// Cross-module consumers use the public capability boundary above.
// --- Module wiring ---
export { NotificationModule } from "./notification.module";

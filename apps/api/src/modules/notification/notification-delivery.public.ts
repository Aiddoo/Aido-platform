/**
 * Notification 모듈 공개 배럴 (클린아키텍처 경계).
 *
 * 외부 모듈은 이 배럴만 임포트한다 (내부 레이어 딥 임포트 금지 — check-boundaries).
 */

export {
  MARKETING_PUSH_OPT_OUT_TOKEN,
  type MarketingPushOptOutTokenPort,
} from "./application/ports/delivery/marketing-push-opt-out-token.port.js";
// --- Data contracts ---
export type { CreateNotificationData } from "./application/ports/delivery/notification-data.js";
// --- Ports (푸시 프로바이더/rate limiter 추상화) ---
export {
  type BatchPushResult,
  PUSH_PROVIDER,
  type PushPayload,
  type PushProvider,
  type PushReceiptResult,
  type PushResult,
  RetryablePushProviderTransportError,
  type RetryablePushProviderTransportErrorMetadata,
} from "./application/ports/delivery/push-provider.port.js";
export {
  PUSH_RATE_LIMITER,
  type PushRateLimiterPort,
} from "./application/ports/delivery/push-rate-limiter.port.js";
// --- Cross-module notification capability ---
export { NotificationPublisher } from "./application/publishers/delivery/notification.publisher.js";
export {
  type FindAlreadyNotifiedRecipientsQuery,
  NotificationHistoryReader,
} from "./application/readers/delivery/notification-history.reader.js";
export { NotificationRecipientLocaleReader } from "./application/readers/delivery/notification-recipient-locale.reader.js";
export { NotificationAccountCleanup } from "./application/services/delivery/notification-account-cleanup.js";
export { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "./domain/services/delivery/transactional-notification-campaign.js";
// --- Type-safe notification copy factories consumed across feature boundaries ---
export {
  createAiSuggestionNotificationMessage,
  createEveningReminderNotificationMessage,
  createLunchNudgeNotificationMessage,
  createMonthlyReportNotificationMessage,
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
  createNudgeSuggestionNotificationMessage,
  createNudgeReplyNotificationMessage,
  createNudgeThanksNotificationMessage,
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
} from "./application/messages/delivery/notification-messages.js";
export type { RetentionNotificationCopySelection } from "./application/messages/delivery/notification-copy.types.js";
// Prisma repository is internal to NotificationModule.
// Cross-module consumers use the public capability boundary above.
// --- Module wiring ---
export { NotificationModule } from "./notification-delivery.module.js";

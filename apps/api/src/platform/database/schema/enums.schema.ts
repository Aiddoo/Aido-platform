import {
  PUSH_PERMISSION_STATUS,
  QUOTA_CHARGE_STATUSES,
  QUOTA_METERS,
  TODO_REPEAT_FREQUENCIES,
} from "@aido/api/vocabulary";
import { pgEnum } from "drizzle-orm/pg-core";

export const accountProvider = pgEnum("AccountProvider", [
  "CREDENTIAL",
  "KAKAO",
  "APPLE",
  "GOOGLE",
  "NAVER",
]);
export const followStatus = pgEnum("FollowStatus", ["PENDING", "ACCEPTED"]);
export const notificationActionType = pgEnum("NotificationActionType", [
  "DEEP_LINK",
  "BROWSER",
  "WEBVIEW",
  "NONE",
]);
export const notificationPurpose = pgEnum("NotificationPurpose", [
  "TRANSACTIONAL",
  "SCHEDULED_SERVICE",
  "ENGAGEMENT",
]);
export const notificationType = pgEnum("NotificationType", [
  "FOLLOW_NEW",
  "FOLLOW_ACCEPTED",
  "NUDGE_RECEIVED",
  "CHEER_RECEIVED",
  "DAILY_COMPLETE",
  "FRIEND_COMPLETED",
  "TODO_REMINDER",
  "TODO_SHARED",
  "MORNING_REMINDER",
  "EVENING_REMINDER",
  "WEEKLY_ACHIEVEMENT",
  "SYSTEM_NOTICE",
  "ADMIN_BROADCAST",
  "ADMIN_TARGETED",
  "MONTHLY_REPORT",
  "AI_SUGGESTION",
  "WEEKLY_REPORT",
  "WINBACK",
  "SOCIAL_DIGEST",
  "NUDGE_SUGGEST",
  "LUNCH_NUDGE",
  "STREAK_AT_RISK",
  "WEATHER_MORNING",
  "WEATHER_EVENING",
  "NUDGE_REPLIED",
  "NUDGE_THANKED",
  "INVITE_JOINED",
  "INVITE_REWARDED",
  "PREMIUM_GRANT_ENDING",
  "INVITE_PROGRESS",
  "INVITE_QUALIFY_REMINDER",
]);
export const nudgeReplyKind = pgEnum("NudgeReplyKind", ["STARTING", "THANKFUL", "LATER"]);
export const platform = pgEnum("Platform", ["IOS", "ANDROID"]);
export const pushPermissionStatus = pgEnum("PushPermissionStatus", PUSH_PERMISSION_STATUS);
export const pushDeliveryMode = pgEnum("PushDeliveryMode", ["SINGLE", "BATCH"]);
export const pushDeliveryStatus = pgEnum("PushDeliveryStatus", [
  "PENDING",
  "TICKET_ACCEPTED",
  "DELIVERED",
  "FAILED",
  "UNKNOWN",
]);
export const pushDispatchOutboxStatus = pgEnum("PushDispatchOutboxStatus", [
  "PENDING",
  "PROCESSING",
  "PUBLISHED",
]);
export const pushDispatchStatus = pgEnum("PushDispatchStatus", [
  "PENDING",
  "PROCESSING",
  "SENT",
  "SKIPPED",
  "FAILED",
  "HOLDOUT",
]);
export const pushRateLimitPhase = pgEnum("PushRateLimitPhase", ["GENERAL", "ENGAGEMENT"]);
export const quotaChargeStatus = pgEnum("QuotaChargeStatus", QUOTA_CHARGE_STATUSES);
export const quotaMeter = pgEnum("QuotaMeter", QUOTA_METERS);
export const reportType = pgEnum("ReportType", ["WEEKLY", "MONTHLY"]);
export const retentionExperimentStageName = pgEnum("RetentionExperimentStageName", [
  "D0",
  "D1",
  "D3",
  "D7",
]);
export const retentionExperimentStageStatus = pgEnum("RetentionExperimentStageStatus", [
  "SCHEDULED",
  "SKIPPED",
  "OUTBOXED",
  "EVALUATED",
]);
export const retentionExperimentVariant = pgEnum("RetentionExperimentVariant", [
  "CONTROL",
  "TREATMENT",
]);
export const securityEvent = pgEnum("SecurityEvent", [
  "REGISTRATION",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "TOKEN_REFRESH",
  "TOKEN_REVOKED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "EMAIL_VERIFIED",
  "TWO_FACTOR_ENABLED",
  "TWO_FACTOR_DISABLED",
  "SUSPICIOUS_ACTIVITY",
  "ACCOUNT_LOCKED",
  "ACCOUNT_UNLOCKED",
  "SESSION_REVOKED",
  "SESSION_REVOKED_ALL",
  "OAUTH_LINKED",
  "OAUTH_UNLINKED",
  "OAUTH_AUTO_LINKED",
  "OAUTH_LINK_REQUIRED",
  "ACCOUNT_DELETION_REQUESTED",
  "ACCOUNT_HARD_DELETED",
  "ACCOUNT_RESTORED",
  "PASSWORD_SETUP",
]);
export const subscriptionEnvironment = pgEnum("SubscriptionEnvironment", ["SANDBOX", "PRODUCTION"]);
export const subscriptionStatus = pgEnum("SubscriptionStatus", [
  "FREE",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export const suggestionStatus = pgEnum("SuggestionStatus", ["PENDING", "ACCEPTED", "DISMISSED"]);
export const timeFormat = pgEnum("TimeFormat", ["TWELVE_HOUR", "TWENTY_FOUR_HOUR"]);
export const todoVisibility = pgEnum("TodoVisibility", ["PUBLIC", "PRIVATE"]);
export const todoRepeatFrequency = pgEnum("TodoRepeatFrequency", TODO_REPEAT_FREQUENCIES);
export const userRole = pgEnum("UserRole", ["USER", "ADMIN"]);
export const userStatus = pgEnum("UserStatus", ["ACTIVE", "LOCKED", "SUSPENDED", "PENDING_VERIFY"]);
export const verificationType = pgEnum("VerificationType", [
  "EMAIL_VERIFY",
  "PASSWORD_RESET",
  "PASSWORD_SETUP",
]);
export const inviteRedemptionStatus = pgEnum("InviteRedemptionStatus", [
  "JOINED",
  "QUALIFIED",
  "REWARDED",
  "REJECTED",
]);
export const inviteRejectionReason = pgEnum("InviteRejectionReason", [
  "EXPIRED",
  "INVITER_MONTHLY_CAP",
]);
export const inviteStatus = pgEnum("InviteStatus", ["ACTIVE", "REVOKED"]);
export const premiumGrantSource = pgEnum("PremiumGrantSource", ["INVITE"]);
export const premiumGrantStatus = pgEnum("PremiumGrantStatus", [
  "BANKED",
  "ACTIVE",
  "ENDED",
  "REVOKED",
]);
export const resourceType = pgEnum("ResourceType", ["FRIEND"]);
export const rewardClaimKind = pgEnum("RewardClaimKind", ["INSTALLATION", "IDENTITY"]);
export const rewardGrantStatus = pgEnum("RewardGrantStatus", ["PENDING", "APPLIED", "FAILED"]);
export const rewardSourceType = pgEnum("RewardSourceType", ["INVITE_REDEMPTION"]);
export const rewardType = pgEnum("RewardType", ["PREMIUM_DAYS", "FRIEND_SLOT"]);
export const userReportReason = pgEnum("UserReportReason", [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE",
  "IMPERSONATION",
  "OTHER",
]);
export const userReportStatus = pgEnum("UserReportStatus", ["OPEN", "RESOLVED"]);
export const userReportTargetType = pgEnum("UserReportTargetType", [
  "PROFILE",
  "TODO",
  "COMMENT",
  "NUDGE_MESSAGE",
  "CHEER_MESSAGE",
]);

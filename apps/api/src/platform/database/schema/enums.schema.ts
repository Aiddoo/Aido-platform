import {
  AI_REPORT_TYPES,
  AI_SUGGESTION_STATUSES,
  FOLLOW_STATUSES,
  GRANTABLE_FEATURE_KEYS,
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_PURPOSES,
  NUDGE_REPLY_KINDS,
  PUSH_DEVICE_PLATFORM,
  PUSH_PERMISSION_STATUS,
  PREMIUM_GRANT_SOURCES,
  PREMIUM_GRANT_STATUSES,
  QUOTA_CHARGE_STATUSES,
  QUOTA_METERS,
  REDEMPTION_REJECTION_REASON,
  REDEMPTION_STATUS,
  REWARD_TYPE,
  SECURITY_EVENT,
  SUBSCRIPTION_ENVIRONMENTS,
  SUBSCRIPTION_STATUS,
  TIME_FORMATS,
  TODO_REPEAT_FREQUENCIES,
  TODO_VISIBILITIES,
  USER_REPORT_REASONS,
  USER_REPORT_STATUSES,
  USER_REPORT_TARGET_TYPES,
  USER_ROLE,
  USER_STATUS,
  VERIFICATION_TYPE,
} from "@aido/api/vocabulary";
import { pgEnum } from "drizzle-orm/pg-core";

// drizzle-kit은 #api 별칭을 못 따라가므로 상대 경로로 둔다
import { ACCOUNT_PROVIDERS_IN_DB_ORDER } from "../../../modules/identity/auth/domain/auth.constants.js";
import { NOTIFICATION_TYPES } from "../../../modules/notification/inbox/domain/notification-type.constants.js";
import {
  PUSH_DELIVERY_ATTEMPT_STATUSES,
  PUSH_DELIVERY_MODES,
  PUSH_DISPATCH_OUTBOX_STATUSES,
  PUSH_DISPATCH_STATUSES,
  PUSH_RATE_LIMIT_PHASES,
} from "../../../modules/notification/push/domain/push-delivery-status.constants.js";
import {
  RETENTION_STAGE_NAMES,
  RETENTION_STAGE_STATUSES,
  RETENTION_VARIANTS,
} from "../../../modules/notification/retention/domain/retention.constants.js";
import {
  REWARD_CLAIM_KINDS,
  REWARD_GRANT_STATUSES,
  REWARD_SOURCE_TYPES,
} from "../../../modules/social/invite-redemptions/domain/invite-redemptions.constants.js";
import { INVITE_STATUSES } from "../../../modules/social/invites/domain/invites.constants.js";

export const accountProvider = pgEnum("AccountProvider", ACCOUNT_PROVIDERS_IN_DB_ORDER);
export const followStatus = pgEnum("FollowStatus", FOLLOW_STATUSES);
export const notificationActionType = pgEnum("NotificationActionType", NOTIFICATION_ACTION_TYPE);
export const notificationPurpose = pgEnum("NotificationPurpose", NOTIFICATION_PURPOSES);
export const notificationType = pgEnum("NotificationType", NOTIFICATION_TYPES);
export const nudgeReplyKind = pgEnum("NudgeReplyKind", NUDGE_REPLY_KINDS);
export const platform = pgEnum("Platform", PUSH_DEVICE_PLATFORM);
export const pushPermissionStatus = pgEnum("PushPermissionStatus", PUSH_PERMISSION_STATUS);
export const pushDeliveryMode = pgEnum("PushDeliveryMode", PUSH_DELIVERY_MODES);
export const pushDeliveryStatus = pgEnum("PushDeliveryStatus", PUSH_DELIVERY_ATTEMPT_STATUSES);
export const pushDispatchOutboxStatus = pgEnum(
  "PushDispatchOutboxStatus",
  PUSH_DISPATCH_OUTBOX_STATUSES,
);
export const pushDispatchStatus = pgEnum("PushDispatchStatus", PUSH_DISPATCH_STATUSES);
export const pushRateLimitPhase = pgEnum("PushRateLimitPhase", PUSH_RATE_LIMIT_PHASES);
export const quotaChargeStatus = pgEnum("QuotaChargeStatus", QUOTA_CHARGE_STATUSES);
export const quotaMeter = pgEnum("QuotaMeter", QUOTA_METERS);
export const reportType = pgEnum("ReportType", AI_REPORT_TYPES);
export const retentionExperimentStageName = pgEnum(
  "RetentionExperimentStageName",
  RETENTION_STAGE_NAMES,
);
export const retentionExperimentStageStatus = pgEnum(
  "RetentionExperimentStageStatus",
  RETENTION_STAGE_STATUSES,
);
export const retentionExperimentVariant = pgEnum("RetentionExperimentVariant", RETENTION_VARIANTS);
export const securityEvent = pgEnum("SecurityEvent", SECURITY_EVENT);
export const subscriptionEnvironment = pgEnum("SubscriptionEnvironment", SUBSCRIPTION_ENVIRONMENTS);
export const subscriptionStatus = pgEnum("SubscriptionStatus", SUBSCRIPTION_STATUS);
export const suggestionStatus = pgEnum("SuggestionStatus", AI_SUGGESTION_STATUSES);
export const timeFormat = pgEnum("TimeFormat", TIME_FORMATS);
export const todoVisibility = pgEnum("TodoVisibility", TODO_VISIBILITIES);
export const todoRepeatFrequency = pgEnum("TodoRepeatFrequency", TODO_REPEAT_FREQUENCIES);
export const userRole = pgEnum("UserRole", USER_ROLE);
export const userStatus = pgEnum("UserStatus", USER_STATUS);
export const verificationType = pgEnum("VerificationType", VERIFICATION_TYPE);
export const inviteRedemptionStatus = pgEnum("InviteRedemptionStatus", REDEMPTION_STATUS);
export const inviteRejectionReason = pgEnum("InviteRejectionReason", REDEMPTION_REJECTION_REASON);
export const inviteStatus = pgEnum("InviteStatus", INVITE_STATUSES);
export const premiumGrantSource = pgEnum("PremiumGrantSource", PREMIUM_GRANT_SOURCES);
export const premiumGrantStatus = pgEnum("PremiumGrantStatus", PREMIUM_GRANT_STATUSES);
// 테이블·enum 이름(ResourceBonus·ResourceType)은 배포된 DB 이름이다. 코드에서는 기능 자리(grant)다
export const resourceType = pgEnum("ResourceType", GRANTABLE_FEATURE_KEYS);
export const rewardClaimKind = pgEnum("RewardClaimKind", REWARD_CLAIM_KINDS);
export const rewardGrantStatus = pgEnum("RewardGrantStatus", REWARD_GRANT_STATUSES);
export const rewardSourceType = pgEnum("RewardSourceType", REWARD_SOURCE_TYPES);
export const rewardType = pgEnum("RewardType", REWARD_TYPE);
export const userReportReason = pgEnum("UserReportReason", USER_REPORT_REASONS);
export const userReportStatus = pgEnum("UserReportStatus", USER_REPORT_STATUSES);
export const userReportTargetType = pgEnum("UserReportTargetType", USER_REPORT_TARGET_TYPES);

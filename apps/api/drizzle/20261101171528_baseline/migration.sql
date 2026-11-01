CREATE TYPE "AccountProvider" AS ENUM('CREDENTIAL', 'KAKAO', 'APPLE', 'GOOGLE', 'NAVER');--> statement-breakpoint
CREATE TYPE "FollowStatus" AS ENUM('PENDING', 'ACCEPTED');--> statement-breakpoint
CREATE TYPE "InviteRedemptionStatus" AS ENUM('JOINED', 'QUALIFIED', 'REWARDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "InviteRejectionReason" AS ENUM('EXPIRED', 'INVITER_MONTHLY_CAP');--> statement-breakpoint
CREATE TYPE "InviteStatus" AS ENUM('ACTIVE', 'REVOKED');--> statement-breakpoint
CREATE TYPE "NotificationActionType" AS ENUM('DEEP_LINK', 'BROWSER', 'WEBVIEW', 'NONE');--> statement-breakpoint
CREATE TYPE "NotificationPurpose" AS ENUM('TRANSACTIONAL', 'SCHEDULED_SERVICE', 'ENGAGEMENT');--> statement-breakpoint
CREATE TYPE "NotificationType" AS ENUM('FOLLOW_NEW', 'FOLLOW_ACCEPTED', 'NUDGE_RECEIVED', 'CHEER_RECEIVED', 'DAILY_COMPLETE', 'FRIEND_COMPLETED', 'TODO_REMINDER', 'TODO_SHARED', 'MORNING_REMINDER', 'EVENING_REMINDER', 'WEEKLY_ACHIEVEMENT', 'SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', 'MONTHLY_REPORT', 'AI_SUGGESTION', 'WEEKLY_REPORT', 'WINBACK', 'SOCIAL_DIGEST', 'NUDGE_SUGGEST', 'LUNCH_NUDGE', 'STREAK_AT_RISK', 'WEATHER_MORNING', 'WEATHER_EVENING', 'NUDGE_REPLIED', 'NUDGE_THANKED', 'INVITE_JOINED', 'INVITE_REWARDED', 'PREMIUM_GRANT_ENDING', 'INVITE_PROGRESS', 'INVITE_QUALIFY_REMINDER');--> statement-breakpoint
CREATE TYPE "NudgeReplyKind" AS ENUM('STARTING', 'THANKFUL', 'LATER');--> statement-breakpoint
CREATE TYPE "Platform" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "PremiumGrantSource" AS ENUM('INVITE');--> statement-breakpoint
CREATE TYPE "PremiumGrantStatus" AS ENUM('BANKED', 'ACTIVE', 'ENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "PushDeliveryMode" AS ENUM('SINGLE', 'BATCH');--> statement-breakpoint
CREATE TYPE "PushDeliveryStatus" AS ENUM('PENDING', 'TICKET_ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "PushDispatchOutboxStatus" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "PushDispatchStatus" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED', 'HOLDOUT');--> statement-breakpoint
CREATE TYPE "PushRateLimitPhase" AS ENUM('GENERAL', 'ENGAGEMENT');--> statement-breakpoint
CREATE TYPE "ReportType" AS ENUM('WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "ResourceType" AS ENUM('FRIEND');--> statement-breakpoint
CREATE TYPE "RetentionExperimentStageName" AS ENUM('D0', 'D1', 'D3', 'D7');--> statement-breakpoint
CREATE TYPE "RetentionExperimentStageStatus" AS ENUM('SCHEDULED', 'SKIPPED', 'OUTBOXED', 'EVALUATED');--> statement-breakpoint
CREATE TYPE "RetentionExperimentVariant" AS ENUM('CONTROL', 'TREATMENT');--> statement-breakpoint
CREATE TYPE "RetentionOutboxStatus" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TYPE "RewardClaimKind" AS ENUM('INSTALLATION', 'IDENTITY');--> statement-breakpoint
CREATE TYPE "RewardGrantStatus" AS ENUM('PENDING', 'APPLIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "RewardSourceType" AS ENUM('INVITE_REDEMPTION');--> statement-breakpoint
CREATE TYPE "RewardType" AS ENUM('PREMIUM_DAYS', 'FRIEND_SLOT');--> statement-breakpoint
CREATE TYPE "SecurityEvent" AS ENUM('REGISTRATION', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'TOKEN_REFRESH', 'TOKEN_REVOKED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'EMAIL_VERIFIED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'SUSPICIOUS_ACTIVITY', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_REVOKED', 'SESSION_REVOKED_ALL', 'OAUTH_LINKED', 'OAUTH_UNLINKED', 'OAUTH_AUTO_LINKED', 'OAUTH_LINK_REQUIRED', 'ACCOUNT_DELETION_REQUESTED', 'ACCOUNT_HARD_DELETED', 'ACCOUNT_RESTORED', 'PASSWORD_SETUP');--> statement-breakpoint
CREATE TYPE "SubscriptionStatus" AS ENUM('FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "SuggestionStatus" AS ENUM('PENDING', 'ACCEPTED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "TimeFormat" AS ENUM('TWELVE_HOUR', 'TWENTY_FOUR_HOUR');--> statement-breakpoint
CREATE TYPE "TodoVisibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "UserReportReason" AS ENUM('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "UserReportStatus" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "UserReportTargetType" AS ENUM('PROFILE', 'TODO', 'COMMENT', 'NUDGE_MESSAGE', 'CHEER_MESSAGE');--> statement-breakpoint
CREATE TYPE "UserRole" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "UserStatus" AS ENUM('ACTIVE', 'LOCKED', 'SUSPENDED', 'PENDING_VERIFY');--> statement-breakpoint
CREATE TYPE "VerificationType" AS ENUM('EMAIL_VERIFY', 'PASSWORD_RESET', 'PASSWORD_SETUP');--> statement-breakpoint
CREATE TABLE "ResourceBonus" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"quantity" integer NOT NULL,
	"resource" "ResourceType" NOT NULL,
	"sourceKey" varchar(128) NOT NULL CONSTRAINT "ResourceBonus_sourceKey_key" UNIQUE,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AiReport" (
	"aiSummary" text NOT NULL,
	"aiTips" jsonb NOT NULL,
	"categoryBreakdown" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"dayPatterns" jsonb NOT NULL,
	"generatedAt" timestamp(3) NOT NULL,
	"hasActivity" boolean NOT NULL,
	"id" serial PRIMARY KEY,
	"locale" varchar(10) DEFAULT 'ko' NOT NULL,
	"period" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"timePatterns" jsonb NOT NULL,
	"type" "ReportType" NOT NULL,
	"userId" text NOT NULL,
	"year" integer NOT NULL,
	"contentSource" varchar(16),
	"promptVersion" varchar(40),
	CONSTRAINT "AiReport_userId_type_year_period_key" UNIQUE("userId","type","year","period")
);
--> statement-breakpoint
CREATE TABLE "RecurringSuggestion" (
	"confidence" double precision NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"daysOfWeek" jsonb NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" serial PRIMARY KEY,
	"matchedTodos" jsonb NOT NULL,
	"reason" text NOT NULL,
	"scheduledTime" text,
	"status" "SuggestionStatus" DEFAULT 'PENDING'::"SuggestionStatus" NOT NULL,
	"suggestedCategoryId" integer,
	"title" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PremiumGrant" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"durationDays" integer NOT NULL,
	"endingNotifiedAt" timestamp(3),
	"endsAt" timestamp(3),
	"id" text PRIMARY KEY,
	"source" "PremiumGrantSource" NOT NULL,
	"sourceKey" varchar(128) NOT NULL CONSTRAINT "PremiumGrant_sourceKey_key" UNIQUE,
	"startsAt" timestamp(3),
	"status" "PremiumGrantStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"cancelledAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"dataRetentionUntil" timestamp(3),
	"deletedAt" timestamp(3),
	"expiresAt" timestamp(3) NOT NULL,
	"id" serial PRIMARY KEY,
	"lastProcessedEventId" varchar(255),
	"productId" varchar(100) NOT NULL,
	"revenueCatId" varchar(255) NOT NULL CONSTRAINT "Subscription_revenueCatId_key" UNIQUE,
	"startedAt" timestamp(3) NOT NULL,
	"status" "SubscriptionStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SubscriptionEventReceipt" (
	"eventId" varchar(255),
	"eventType" varchar(50) NOT NULL,
	"processedAt" timestamp(3) NOT NULL,
	"provider" varchar(30),
	CONSTRAINT "SubscriptionEventReceipt_pkey" PRIMARY KEY("provider","eventId")
);
--> statement-breakpoint
CREATE TABLE "TodoComment" (
	"authorId" text NOT NULL,
	"clientRequestId" uuid NOT NULL,
	"content" varchar(500),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deletedAt" timestamp(3),
	"depth" integer DEFAULT 0 NOT NULL,
	"editedAt" timestamp(3),
	"id" text PRIMARY KEY,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"parentId" text,
	"path" text[] DEFAULT '{}'::text[] NOT NULL,
	"replyCount" integer DEFAULT 0 NOT NULL,
	"requestFingerprint" char(64),
	"rootId" text,
	"todoId" integer NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "TodoComment_authorId_clientRequestId_key" UNIQUE("authorId","clientRequestId")
);
--> statement-breakpoint
CREATE TABLE "TodoCommentLike" (
	"commentId" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"notifiedAt" timestamp(3),
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text,
	CONSTRAINT "TodoCommentLike_pkey" PRIMARY KEY("commentId","userId")
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"accessToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"password" varchar(128),
	"provider" "AccountProvider" NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refreshToken" text,
	"scope" varchar(500),
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE("provider","providerAccountId"),
	CONSTRAINT "Account_userId_provider_key" UNIQUE("userId","provider")
);
--> statement-breakpoint
CREATE TABLE "LoginAttempt" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL,
	"failureReason" varchar(100),
	"id" serial PRIMARY KEY,
	"ipAddress" varchar(45) NOT NULL,
	"provider" "AccountProvider",
	"success" boolean NOT NULL,
	"userAgent" varchar(500) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OAuthState" (
	"accessToken" varchar(1000),
	"accountRestored" boolean,
	"codeVerifier" varchar(128),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"exchangeCode" varchar(64) CONSTRAINT "OAuthState_exchangeCode_key" UNIQUE,
	"exchangedAt" timestamp(3),
	"expiresAt" timestamp(3) NOT NULL,
	"id" serial PRIMARY KEY,
	"initiatingUserId" varchar(36),
	"ipAddress" varchar(45),
	"mode" varchar(10),
	"profileImage" varchar(500),
	"provider" "AccountProvider" NOT NULL,
	"redirectUri" varchar(500) NOT NULL,
	"refreshToken" varchar(1000),
	"state" varchar(64) NOT NULL CONSTRAINT "OAuthState_state_key" UNIQUE,
	"userAgent" varchar(500),
	"userId" varchar(255),
	"userName" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "SecurityLog" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"event" "SecurityEvent" NOT NULL,
	"id" serial PRIMARY KEY,
	"ipAddress" varchar(45) NOT NULL,
	"metadata" jsonb,
	"userAgent" varchar(500) NOT NULL,
	"userId" text
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deviceFingerprint" varchar(64) NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" text PRIMARY KEY,
	"ipAddress" varchar(45) NOT NULL,
	"lastUsedAt" timestamp(3) DEFAULT now() NOT NULL,
	"previousTokenHash" varchar(64),
	"refreshTokenHash" varchar(64) NOT NULL CONSTRAINT "Session_refreshTokenHash_key" UNIQUE,
	"revokedAt" timestamp(3),
	"revokedReason" varchar(200),
	"tokenFamily" varchar(36) NOT NULL,
	"tokenVersion" integer DEFAULT 1 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userAgent" varchar(500) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"aiUsageCount" integer DEFAULT 0 NOT NULL,
	"aiUsageResetAt" timestamp(3) DEFAULT now() NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deletedAt" timestamp(3),
	"email" varchar(255) NOT NULL CONSTRAINT "User_email_key" UNIQUE,
	"emailVerifiedAt" timestamp(3),
	"id" text PRIMARY KEY,
	"lastActiveAt" timestamp(3),
	"lastLoginAt" timestamp(3),
	"revenueCatUserId" varchar(255) CONSTRAINT "User_revenueCatUserId_key" UNIQUE,
	"role" "UserRole" DEFAULT 'USER'::"UserRole" NOT NULL,
	"status" "UserStatus" DEFAULT 'PENDING_VERIFY'::"UserStatus" NOT NULL,
	"subscriptionExpiresAt" timestamp(3),
	"subscriptionStatus" "SubscriptionStatus" DEFAULT 'FREE'::"SubscriptionStatus" NOT NULL,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"twoFactorSecret" varchar(255),
	"updatedAt" timestamp(3) NOT NULL,
	"userTag" varchar(8) NOT NULL CONSTRAINT "User_userTag_key" UNIQUE,
	"lastSeenAppVersion" varchar(30),
	"lastSeenAppVersionAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "UserActivityDay" (
	"firstSeenAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"lastSeenAt" timestamp(3) DEFAULT now() NOT NULL,
	"localDate" date NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "UserActivityDay_userId_localDate_key" UNIQUE("userId","localDate")
);
--> statement-breakpoint
CREATE TABLE "UserConsent" (
	"agreedTermsVersion" varchar(20),
	"id" text PRIMARY KEY,
	"marketingAgreedAt" timestamp(3),
	"marketingPushAgreedAt" timestamp(3),
	"privacyAgreedAt" timestamp(3),
	"termsAgreedAt" timestamp(3),
	"userId" text NOT NULL CONSTRAINT "UserConsent_userId_key" UNIQUE,
	"aiDataSharingAgreedAt" timestamp(3),
	"aiDataSharingVersion" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "UserLocation" (
	"gridX" integer NOT NULL,
	"gridY" integer NOT NULL,
	"id" text PRIMARY KEY,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL CONSTRAINT "UserLocation_userId_key" UNIQUE
);
--> statement-breakpoint
CREATE TABLE "UserPreference" (
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"eveningReminderHour" integer DEFAULT 19 NOT NULL,
	"eveningReminderMinute" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY,
	"lastCompletedDate" date,
	"locale" varchar(10) DEFAULT 'ko' NOT NULL,
	"longestStreak" integer DEFAULT 0 NOT NULL,
	"morningReminderHour" integer DEFAULT 8 NOT NULL,
	"morningReminderMinute" integer DEFAULT 0 NOT NULL,
	"nightPushEnabled" boolean DEFAULT false NOT NULL,
	"pushEnabled" boolean DEFAULT false NOT NULL,
	"timeFormat" "TimeFormat" DEFAULT 'TWELVE_HOUR'::"TimeFormat" NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"userId" text NOT NULL CONSTRAINT "UserPreference_userId_key" UNIQUE,
	"weatherEveningEnabled" boolean DEFAULT true NOT NULL,
	"weatherEveningHour" integer DEFAULT 17 NOT NULL,
	"weatherEveningMinute" integer DEFAULT 30 NOT NULL,
	"weatherMorningEnabled" boolean DEFAULT true NOT NULL,
	"weatherMorningHour" integer DEFAULT 7 NOT NULL,
	"weatherMorningMinute" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserProfile" (
	"id" text PRIMARY KEY,
	"name" varchar(20),
	"profileImage" varchar(500),
	"userId" text NOT NULL CONSTRAINT "UserProfile_userId_key" UNIQUE
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" serial PRIMARY KEY,
	"token" varchar(64) NOT NULL CONSTRAINT "Verification_token_key" UNIQUE,
	"type" "VerificationType" NOT NULL,
	"usedAt" timestamp(3),
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DailyCompletion" (
	"achievedAt" timestamp(3) NOT NULL,
	"completedTodos" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"date" date NOT NULL,
	"id" text PRIMARY KEY,
	"totalTodos" integer NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "DailyCompletion_userId_date_key" UNIQUE("userId","date")
);
--> statement-breakpoint
CREATE TABLE "WeeklyAchievement" (
	"achievedAt" timestamp(3) NOT NULL,
	"completedTodos" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"totalTodos" integer NOT NULL,
	"userId" text NOT NULL,
	"week" integer NOT NULL,
	"year" integer NOT NULL,
	CONSTRAINT "WeeklyAchievement_userId_year_week_key" UNIQUE("userId","year","week")
);
--> statement-breakpoint
CREATE TABLE "Memo" (
	"content" varchar(5000) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"isPinned" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"actionType" "NotificationActionType" DEFAULT 'DEEP_LINK'::"NotificationActionType" NOT NULL,
	"actionUrl" varchar(1000),
	"body" varchar(500) NOT NULL,
	"campaignKey" varchar(100),
	"cheerId" integer,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"friendId" text,
	"id" serial PRIMARY KEY,
	"isRead" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"notificationDate" date,
	"nudgeId" integer,
	"openedAt" timestamp(3),
	"purpose" "NotificationPurpose" DEFAULT 'TRANSACTIONAL'::"NotificationPurpose" NOT NULL,
	"readAt" timestamp(3),
	"title" varchar(200) NOT NULL,
	"todoId" integer,
	"type" "NotificationType" NOT NULL,
	"userId" text NOT NULL,
	"variantId" varchar(100),
	CONSTRAINT "Notification_todo_comment_action_url_check" CHECK (((type <> 'TODO_SHARED'::"NotificationType") OR ("actionType" <> 'DEEP_LINK'::"NotificationActionType") OR ((metadata ->> 'commentId'::text) IS NULL) OR ("actionUrl" IS NULL))),
	CONSTRAINT "Notification_todo_comment_sender_check" CHECK ((((metadata ->> 'commentId'::text) IS NULL) OR COALESCE(((jsonb_typeof((metadata -> 'senderId'::text)) = 'string'::text) AND (length((metadata ->> 'senderId'::text)) > 0)), false)))
);
--> statement-breakpoint
CREATE TABLE "PushDailyBudget" (
	"automatedCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"lastSentAt" timestamp(3),
	"localDate" date NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "PushDailyBudget_userId_localDate_key" UNIQUE("userId","localDate")
);
--> statement-breakpoint
CREATE TABLE "PushDeliveryAttempt" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"dispatchId" integer NOT NULL,
	"errorCode" varchar(100),
	"errorMessage" varchar(500),
	"expoTicketId" varchar(100) CONSTRAINT "PushDeliveryAttempt_expoTicketId_key" UNIQUE,
	"id" serial PRIMARY KEY,
	"pushTokenId" integer NOT NULL,
	"receiptCheckedAt" timestamp(3),
	"status" "PushDeliveryStatus" DEFAULT 'PENDING'::"PushDeliveryStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"tokenFingerprint" varchar(64),
	CONSTRAINT "PushDeliveryAttempt_dispatchId_pushTokenId_key" UNIQUE("dispatchId","pushTokenId")
);
--> statement-breakpoint
CREATE TABLE "PushDispatch" (
	"campaignKey" varchar(100),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deliveryAttemptCount" integer DEFAULT 0 NOT NULL,
	"id" serial PRIMARY KEY,
	"lastError" varchar(500),
	"localDate" date,
	"notificationId" integer NOT NULL CONSTRAINT "PushDispatch_notificationId_key" UNIQUE,
	"openedAt" timestamp(3),
	"processingJobAttempt" integer,
	"processingJobId" varchar(255),
	"processingStartedAt" timestamp(3),
	"purpose" "NotificationPurpose" NOT NULL,
	"rateLimitReservedAt" timestamp(3),
	"scheduledAt" timestamp(3) DEFAULT now() NOT NULL,
	"sentAt" timestamp(3),
	"skipReason" varchar(100),
	"status" "PushDispatchStatus" DEFAULT 'PENDING'::"PushDispatchStatus" NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	"variantId" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "PushDispatchOutbox" (
	"availableAt" timestamp(3) DEFAULT now() NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deliveryMode" "PushDeliveryMode" NOT NULL,
	"dispatchId" integer PRIMARY KEY,
	"force" boolean DEFAULT false NOT NULL,
	"lastError" varchar(500),
	"lockedAt" timestamp(3),
	"publishAttempts" integer DEFAULT 0 NOT NULL,
	"publishedAt" timestamp(3),
	"status" "PushDispatchOutboxStatus" DEFAULT 'PENDING'::"PushDispatchOutboxStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PushRateLimitReservation" (
	"dispatchId" integer,
	"localDate" date,
	"phase" "PushRateLimitPhase",
	"reservedAt" timestamp(3) DEFAULT now() NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "PushRateLimitReservation_pkey" PRIMARY KEY("dispatchId","phase")
);
--> statement-breakpoint
CREATE TABLE "PushToken" (
	"appVersion" varchar(30),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"deviceId" varchar(255) NOT NULL,
	"id" serial PRIMARY KEY,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastUsedAt" timestamp(3) DEFAULT now() NOT NULL,
	"payloadVersion" integer DEFAULT 1 NOT NULL,
	"platform" "Platform" NOT NULL,
	"token" varchar(255) NOT NULL CONSTRAINT "PushToken_token_key" UNIQUE,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "PushToken_userId_deviceId_key" UNIQUE("userId","deviceId")
);
--> statement-breakpoint
CREATE TABLE "RetentionExperimentAssignment" (
	"assignedAt" timestamp(3) DEFAULT now() NOT NULL,
	"experimentKey" varchar(100) NOT NULL,
	"id" text PRIMARY KEY,
	"startedAt" timestamp(3),
	"userId" text NOT NULL,
	"variant" "RetentionExperimentVariant" NOT NULL,
	CONSTRAINT "RetentionExperimentAssignment_userId_experimentKey_key" UNIQUE("userId","experimentKey")
);
--> statement-breakpoint
CREATE TABLE "RetentionExperimentResult" (
	"assignmentId" text NOT NULL CONSTRAINT "RetentionExperimentResult_assignmentId_key" UNIQUE,
	"id" text PRIMARY KEY,
	"measuredAt" timestamp(3) DEFAULT now() NOT NULL,
	"returnedWithinD7" boolean NOT NULL,
	"todoActionWithinD7" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RetentionExperimentStage" (
	"assignmentId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"notificationId" integer CONSTRAINT "RetentionExperimentStage_notificationId_key" UNIQUE,
	"processedAt" timestamp(3),
	"skipReason" varchar(100),
	"stage" "RetentionExperimentStageName" NOT NULL,
	"status" "RetentionExperimentStageStatus" DEFAULT 'SCHEDULED'::"RetentionExperimentStageStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "RetentionExperimentStage_assignmentId_stage_key" UNIQUE("assignmentId","stage")
);
--> statement-breakpoint
CREATE TABLE "RetentionPushOutbox" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"availableAt" timestamp(3) DEFAULT now() NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"dispatchId" integer NOT NULL CONSTRAINT "RetentionPushOutbox_dispatchId_key" UNIQUE,
	"id" text PRIMARY KEY,
	"lastError" varchar(500),
	"lockedAt" timestamp(3),
	"notificationId" integer NOT NULL CONSTRAINT "RetentionPushOutbox_notificationId_key" UNIQUE,
	"publishedAt" timestamp(3),
	"stageId" text NOT NULL CONSTRAINT "RetentionPushOutbox_stageId_key" UNIQUE,
	"status" "RetentionOutboxStatus" DEFAULT 'PENDING'::"RetentionOutboxStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Todo" (
	"categoryId" integer NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"endDate" date,
	"id" serial PRIMARY KEY,
	"isAllDay" boolean DEFAULT true NOT NULL,
	"recurrenceGroupId" varchar(36),
	"scheduledTime" timestamp(3) with time zone,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"startDate" date NOT NULL,
	"title" varchar(200) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"visibility" "TodoVisibility" DEFAULT 'PUBLIC'::"TodoVisibility" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TodoCategory" (
	"color" varchar(7) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"name" varchar(50) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "TodoCategory_userId_name_key" UNIQUE("userId","name")
);
--> statement-breakpoint
CREATE TABLE "TodoItem" (
	"completed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"todoId" integer NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TodoView" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"todoId" integer,
	"viewerId" text,
	CONSTRAINT "TodoView_pkey" PRIMARY KEY("todoId","viewerId")
);
--> statement-breakpoint
CREATE TABLE "Cheer" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"message" varchar(200),
	"readAt" timestamp(3),
	"receiverId" text NOT NULL,
	"senderId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Follow" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"followerId" text NOT NULL,
	"followingId" text NOT NULL,
	"id" text PRIMARY KEY,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"status" "FollowStatus" DEFAULT 'PENDING'::"FollowStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "Follow_followerId_followingId_key" UNIQUE("followerId","followingId")
);
--> statement-breakpoint
CREATE TABLE "Invite" (
	"code" varchar(6) NOT NULL CONSTRAINT "Invite_code_key" UNIQUE,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"inviterId" text NOT NULL,
	"revokedAt" timestamp(3),
	"status" "InviteStatus" DEFAULT 'ACTIVE'::"InviteStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "InviteActiveDay" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"localDate" date,
	"redemptionId" text,
	CONSTRAINT "InviteActiveDay_pkey" PRIMARY KEY("redemptionId","localDate")
);
--> statement-breakpoint
CREATE TABLE "InviteRedemption" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" text PRIMARY KEY,
	"inviteId" text,
	"inviteeId" text NOT NULL CONSTRAINT "InviteRedemption_inviteeId_key" UNIQUE,
	"inviterId" text,
	"inviterRewardEligible" boolean DEFAULT true NOT NULL,
	"joinedAt" timestamp(3) NOT NULL,
	"qualifiedAt" timestamp(3),
	"rejectedAt" timestamp(3),
	"rejectionReason" "InviteRejectionReason",
	"rewardedAt" timestamp(3),
	"status" "InviteRedemptionStatus" DEFAULT 'JOINED'::"InviteRedemptionStatus" NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"qualifyReminderSentAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "Nudge" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"message" varchar(200),
	"readAt" timestamp(3),
	"receiverId" text NOT NULL,
	"repliedAt" timestamp(3),
	"replyKind" "NudgeReplyKind",
	"replyUpdatedAt" timestamp(3),
	"senderId" text NOT NULL,
	"thankedAt" timestamp(3),
	"todoId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReminderNudge" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"message" varchar(200),
	"receiverId" text NOT NULL,
	"senderId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RewardClaim" (
	"claimHash" char(64) PRIMARY KEY,
	"claimKind" "RewardClaimKind" NOT NULL,
	"firstClaimedAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RewardGrant" (
	"appliedAt" timestamp(3),
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"lastErrorCode" varchar(100),
	"quantity" integer NOT NULL,
	"recipientId" text NOT NULL,
	"rewardType" "RewardType" NOT NULL,
	"sourceId" varchar(64) NOT NULL,
	"sourceType" "RewardSourceType" NOT NULL,
	"status" "RewardGrantStatus" DEFAULT 'PENDING'::"RewardGrantStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "RewardGrant_sourceType_sourceId_recipientId_rewardType_key" UNIQUE("sourceType","sourceId","recipientId","rewardType")
);
--> statement-breakpoint
CREATE TABLE "UserBlock" (
	"blockedId" text NOT NULL,
	"blockerId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	CONSTRAINT "UserBlock_blockerId_blockedId_key" UNIQUE("blockerId","blockedId")
);
--> statement-breakpoint
CREATE TABLE "UserReport" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"detail" varchar(500),
	"id" text PRIMARY KEY,
	"reason" "UserReportReason" NOT NULL,
	"reporterId" text NOT NULL,
	"status" "UserReportStatus" DEFAULT 'OPEN'::"UserReportStatus" NOT NULL,
	"targetId" varchar(64),
	"targetType" "UserReportTargetType" NOT NULL,
	"targetUserId" text NOT NULL,
	"resolutionNote" varchar(500),
	"resolvedAt" timestamp(3),
	"resolvedById" text
);
--> statement-breakpoint
CREATE INDEX "ResourceBonus_userId_resource_idx" ON "ResourceBonus" ("userId","resource");--> statement-breakpoint
CREATE INDEX "AiReport_userId_type_generatedAt_idx" ON "AiReport" ("userId","type","generatedAt");--> statement-breakpoint
CREATE INDEX "AiReport_userId_type_idx" ON "AiReport" ("userId","type");--> statement-breakpoint
CREATE INDEX "RecurringSuggestion_userId_expiresAt_idx" ON "RecurringSuggestion" ("userId","expiresAt");--> statement-breakpoint
CREATE INDEX "RecurringSuggestion_userId_status_idx" ON "RecurringSuggestion" ("userId","status");--> statement-breakpoint
CREATE INDEX "RecurringSuggestion_userId_updatedAt_idx" ON "RecurringSuggestion" ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "PremiumGrant_status_endsAt_idx" ON "PremiumGrant" ("status","endsAt");--> statement-breakpoint
CREATE INDEX "PremiumGrant_userId_status_idx" ON "PremiumGrant" ("userId","status");--> statement-breakpoint
CREATE INDEX "Subscription_deletedAt_idx" ON "Subscription" ("deletedAt");--> statement-breakpoint
CREATE INDEX "Subscription_status_expiresAt_idx" ON "Subscription" ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "Subscription_userId_idx" ON "Subscription" ("userId");--> statement-breakpoint
CREATE INDEX "TodoComment_todoId_parentId_createdAt_id_idx" ON "TodoComment" ("todoId","parentId","createdAt","id");--> statement-breakpoint
CREATE INDEX "TodoComment_todoId_parentId_likeCount_replyCount_createdAt__idx" ON "TodoComment" ("todoId","parentId","likeCount","replyCount","createdAt","id");--> statement-breakpoint
CREATE INDEX "TodoComment_todoId_rootId_idx" ON "TodoComment" ("todoId","rootId");--> statement-breakpoint
CREATE INDEX "TodoCommentLike_userId_isActive_idx" ON "TodoCommentLike" ("userId","isActive");--> statement-breakpoint
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt" ("createdAt");--> statement-breakpoint
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt" ("email","createdAt");--> statement-breakpoint
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt" ("ipAddress","createdAt");--> statement-breakpoint
CREATE INDEX "LoginAttempt_provider_createdAt_idx" ON "LoginAttempt" ("provider","createdAt");--> statement-breakpoint
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState" ("expiresAt");--> statement-breakpoint
CREATE INDEX "SecurityLog_event_createdAt_idx" ON "SecurityLog" ("event","createdAt");--> statement-breakpoint
CREATE INDEX "SecurityLog_ipAddress_createdAt_idx" ON "SecurityLog" ("ipAddress","createdAt");--> statement-breakpoint
CREATE INDEX "SecurityLog_userId_createdAt_idx" ON "SecurityLog" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");--> statement-breakpoint
CREATE INDEX "Session_tokenFamily_idx" ON "Session" ("tokenFamily");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");--> statement-breakpoint
CREATE INDEX "User_deletedAt_createdAt_idx" ON "User" ("deletedAt","createdAt");--> statement-breakpoint
CREATE INDEX "User_deletedAt_idx" ON "User" ("deletedAt");--> statement-breakpoint
CREATE INDEX "User_deletedAt_lastActiveAt_idx" ON "User" ("deletedAt","lastActiveAt");--> statement-breakpoint
CREATE INDEX "User_status_deletedAt_lastLoginAt_idx" ON "User" ("status","deletedAt","lastLoginAt");--> statement-breakpoint
CREATE INDEX "User_status_idx" ON "User" ("status");--> statement-breakpoint
CREATE INDEX "User_subscriptionStatus_idx" ON "User" ("subscriptionStatus");--> statement-breakpoint
CREATE INDEX "UserActivityDay_firstSeenAt_idx" ON "UserActivityDay" ("firstSeenAt");--> statement-breakpoint
CREATE INDEX "UserActivityDay_localDate_idx" ON "UserActivityDay" ("localDate");--> statement-breakpoint
CREATE INDEX "UserPreference_pushEnabled_timezone_eveningReminderHour_eve_idx" ON "UserPreference" ("pushEnabled","timezone","eveningReminderHour","eveningReminderMinute");--> statement-breakpoint
CREATE INDEX "UserPreference_pushEnabled_timezone_idx" ON "UserPreference" ("pushEnabled","timezone");--> statement-breakpoint
CREATE INDEX "UserPreference_pushEnabled_timezone_morningReminderHour_mor_idx" ON "UserPreference" ("pushEnabled","timezone","morningReminderHour","morningReminderMinute");--> statement-breakpoint
CREATE INDEX "UserPreference_pushEnabled_weatherEveningEnabled_timezone_w_idx" ON "UserPreference" ("pushEnabled","weatherEveningEnabled","timezone","weatherEveningHour","weatherEveningMinute");--> statement-breakpoint
CREATE INDEX "UserPreference_pushEnabled_weatherMorningEnabled_timezone_w_idx" ON "UserPreference" ("pushEnabled","weatherMorningEnabled","timezone","weatherMorningHour","weatherMorningMinute");--> statement-breakpoint
CREATE INDEX "Verification_userId_type_idx" ON "Verification" ("userId","type");--> statement-breakpoint
CREATE INDEX "WeeklyAchievement_userId_year_idx" ON "WeeklyAchievement" ("userId","year");--> statement-breakpoint
CREATE INDEX "WeeklyAchievement_year_week_idx" ON "WeeklyAchievement" ("year","week");--> statement-breakpoint
CREATE INDEX "Memo_userId_isPinned_sortOrder_idx" ON "Memo" ("userId","isPinned","sortOrder");--> statement-breakpoint
CREATE INDEX "Memo_userId_sortOrder_idx" ON "Memo" ("userId","sortOrder");--> statement-breakpoint
CREATE INDEX "Notification_comment_actor_cleanup_idx" ON "Notification" ((metadata ->> 'senderId'::text)) WHERE ((metadata ->> 'senderId'::text) IS NOT NULL);--> statement-breakpoint
CREATE INDEX "Notification_createdAt_idx" ON "Notification" ("createdAt");--> statement-breakpoint
CREATE INDEX "Notification_friend_actor_cleanup_idx" ON "Notification" ("friendId") WHERE ("friendId" IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_todo_reminder_dedup" ON "Notification" ("todoId","type",(metadata ->> 'stage'::text)) WHERE ((type = 'TODO_REMINDER'::"NotificationType") AND ("todoId" IS NOT NULL));--> statement-breakpoint
CREATE INDEX "Notification_todoId_type_createdAt_idx" ON "Notification" ("todoId","type","createdAt");--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification" ("userId","createdAt","id");--> statement-breakpoint
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification" ("userId","isRead","createdAt");--> statement-breakpoint
CREATE INDEX "Notification_userId_type_idx" ON "Notification" ("userId","type");--> statement-breakpoint
CREATE INDEX "Notification_userId_type_notificationDate_idx" ON "Notification" ("userId","type","notificationDate");--> statement-breakpoint
CREATE INDEX "PushDeliveryAttempt_status_createdAt_idx" ON "PushDeliveryAttempt" ("status","createdAt");--> statement-breakpoint
CREATE INDEX "PushDispatch_campaignKey_status_createdAt_idx" ON "PushDispatch" ("campaignKey","status","createdAt");--> statement-breakpoint
CREATE INDEX "PushDispatch_processing_lease_idx" ON "PushDispatch" ("processingStartedAt") WHERE (status = 'PROCESSING'::"PushDispatchStatus");--> statement-breakpoint
CREATE INDEX "PushDispatch_status_scheduledAt_idx" ON "PushDispatch" ("status","scheduledAt");--> statement-breakpoint
CREATE INDEX "PushDispatch_userId_localDate_purpose_idx" ON "PushDispatch" ("userId","localDate","purpose");--> statement-breakpoint
CREATE INDEX "PushDispatchOutbox_status_availableAt_dispatchId_idx" ON "PushDispatchOutbox" ("status","availableAt","dispatchId");--> statement-breakpoint
CREATE INDEX "PushDispatchOutbox_status_lockedAt_idx" ON "PushDispatchOutbox" ("status","lockedAt");--> statement-breakpoint
CREATE INDEX "PushRateLimitReservation_phase_userId_localDate_reservedAt_idx" ON "PushRateLimitReservation" ("phase","userId","localDate","reservedAt");--> statement-breakpoint
CREATE INDEX "PushRateLimitReservation_phase_userId_reservedAt_idx" ON "PushRateLimitReservation" ("phase","userId","reservedAt");--> statement-breakpoint
CREATE INDEX "PushToken_userId_isActive_idx" ON "PushToken" ("userId","isActive");--> statement-breakpoint
CREATE INDEX "RetentionExperimentAssignment_experimentKey_variant_startedAt_i" ON "RetentionExperimentAssignment" ("experimentKey","variant","startedAt");--> statement-breakpoint
CREATE INDEX "RetentionExperimentResult_measuredAt_idx" ON "RetentionExperimentResult" ("measuredAt");--> statement-breakpoint
CREATE INDEX "RetentionExperimentStage_status_stage_createdAt_idx" ON "RetentionExperimentStage" ("status","stage","createdAt");--> statement-breakpoint
CREATE INDEX "RetentionPushOutbox_status_availableAt_id_idx" ON "RetentionPushOutbox" ("status","availableAt","id");--> statement-breakpoint
CREATE INDEX "RetentionPushOutbox_status_lockedAt_idx" ON "RetentionPushOutbox" ("status","lockedAt");--> statement-breakpoint
CREATE INDEX "Todo_completed_scheduledTime_idx" ON "Todo" ("completed","scheduledTime");--> statement-breakpoint
CREATE INDEX "Todo_recurrenceGroupId_idx" ON "Todo" ("recurrenceGroupId");--> statement-breakpoint
CREATE INDEX "Todo_userId_categoryId_idx" ON "Todo" ("userId","categoryId");--> statement-breakpoint
CREATE INDEX "Todo_userId_completed_startDate_idx" ON "Todo" ("userId","completed","startDate");--> statement-breakpoint
CREATE INDEX "Todo_userId_sortOrder_idx" ON "Todo" ("userId","sortOrder");--> statement-breakpoint
CREATE INDEX "Todo_userId_startDate_endDate_idx" ON "Todo" ("userId","startDate","endDate");--> statement-breakpoint
CREATE INDEX "TodoCategory_userId_sortOrder_idx" ON "TodoCategory" ("userId","sortOrder");--> statement-breakpoint
CREATE INDEX "TodoItem_todoId_sortOrder_idx" ON "TodoItem" ("todoId","sortOrder");--> statement-breakpoint
CREATE INDEX "TodoView_viewerId_createdAt_idx" ON "TodoView" ("viewerId","createdAt");--> statement-breakpoint
CREATE INDEX "Cheer_receiverId_createdAt_idx" ON "Cheer" ("receiverId","createdAt");--> statement-breakpoint
CREATE INDEX "Cheer_senderId_createdAt_idx" ON "Cheer" ("senderId","createdAt");--> statement-breakpoint
CREATE INDEX "Cheer_senderId_receiverId_createdAt_idx" ON "Cheer" ("senderId","receiverId","createdAt");--> statement-breakpoint
CREATE INDEX "Follow_followerId_sortOrder_idx" ON "Follow" ("followerId","sortOrder");--> statement-breakpoint
CREATE INDEX "Follow_followerId_status_idx" ON "Follow" ("followerId","status");--> statement-breakpoint
CREATE INDEX "Follow_followingId_status_idx" ON "Follow" ("followingId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "Invite_inviterId_active_key" ON "Invite" ("inviterId") WHERE (status = 'ACTIVE'::"InviteStatus");--> statement-breakpoint
CREATE INDEX "Invite_inviterId_status_idx" ON "Invite" ("inviterId","status");--> statement-breakpoint
CREATE INDEX "InviteRedemption_inviteId_idx" ON "InviteRedemption" ("inviteId");--> statement-breakpoint
CREATE INDEX "InviteRedemption_inviterId_joinedAt_id_idx" ON "InviteRedemption" ("inviterId","joinedAt","id");--> statement-breakpoint
CREATE INDEX "InviteRedemption_inviterId_status_joinedAt_id_idx" ON "InviteRedemption" ("inviterId","status","joinedAt","id");--> statement-breakpoint
CREATE INDEX "InviteRedemption_status_expiresAt_idx" ON "InviteRedemption" ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "Nudge_receiverId_createdAt_idx" ON "Nudge" ("receiverId","createdAt");--> statement-breakpoint
CREATE INDEX "Nudge_receiverId_id_idx" ON "Nudge" ("receiverId","id");--> statement-breakpoint
CREATE INDEX "Nudge_senderId_createdAt_idx" ON "Nudge" ("senderId","createdAt");--> statement-breakpoint
CREATE INDEX "Nudge_senderId_id_idx" ON "Nudge" ("senderId","id");--> statement-breakpoint
CREATE INDEX "Nudge_senderId_todoId_createdAt_idx" ON "Nudge" ("senderId","todoId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Nudge_thanked_sender_per_todo" ON "Nudge" ("todoId","senderId") WHERE ("thankedAt" IS NOT NULL);--> statement-breakpoint
CREATE INDEX "Nudge_todoId_idx" ON "Nudge" ("todoId");--> statement-breakpoint
CREATE INDEX "Nudge_todoId_receiverId_thankedAt_id_idx" ON "Nudge" ("todoId","receiverId","thankedAt","id");--> statement-breakpoint
CREATE INDEX "ReminderNudge_receiverId_createdAt_idx" ON "ReminderNudge" ("receiverId","createdAt");--> statement-breakpoint
CREATE INDEX "ReminderNudge_senderId_receiverId_createdAt_idx" ON "ReminderNudge" ("senderId","receiverId","createdAt");--> statement-breakpoint
CREATE INDEX "RewardGrant_recipientId_rewardType_createdAt_idx" ON "RewardGrant" ("recipientId","rewardType","createdAt");--> statement-breakpoint
CREATE INDEX "RewardGrant_status_createdAt_idx" ON "RewardGrant" ("status","createdAt");--> statement-breakpoint
CREATE INDEX "UserBlock_blockedId_blockerId_idx" ON "UserBlock" ("blockedId","blockerId");--> statement-breakpoint
CREATE INDEX "UserBlock_blockerId_createdAt_id_idx" ON "UserBlock" ("blockerId","createdAt","id");--> statement-breakpoint
CREATE INDEX "UserReport_reporterId_createdAt_idx" ON "UserReport" ("reporterId","createdAt");--> statement-breakpoint
CREATE INDEX "UserReport_reporterId_target_createdAt_idx" ON "UserReport" ("reporterId","targetUserId","targetType","createdAt");--> statement-breakpoint
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport" ("status","createdAt");--> statement-breakpoint
CREATE INDEX "UserReport_targetUserId_createdAt_idx" ON "UserReport" ("targetUserId","createdAt");--> statement-breakpoint
ALTER TABLE "ResourceBonus" ADD CONSTRAINT "ResourceBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PremiumGrant" ADD CONSTRAINT "PremiumGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TodoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoCommentLike" ADD CONSTRAINT "TodoCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TodoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoCommentLike" ADD CONSTRAINT "TodoCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SecurityLog" ADD CONSTRAINT "SecurityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "DailyCompletion" ADD CONSTRAINT "DailyCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "WeeklyAchievement" ADD CONSTRAINT "WeeklyAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDailyBudget" ADD CONSTRAINT "PushDailyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushDispatchOutbox" ADD CONSTRAINT "PushDispatchOutbox_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushRateLimitReservation" ADD CONSTRAINT "PushRateLimitReservation_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RetentionExperimentAssignment" ADD CONSTRAINT "RetentionExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RetentionExperimentResult" ADD CONSTRAINT "RetentionExperimentResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RetentionExperimentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RetentionExperimentStage" ADD CONSTRAINT "RetentionExperimentStage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RetentionExperimentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RetentionPushOutbox" ADD CONSTRAINT "RetentionPushOutbox_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "RetentionExperimentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoCategory" ADD CONSTRAINT "TodoCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoView" ADD CONSTRAINT "TodoView_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoView" ADD CONSTRAINT "TodoView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "InviteActiveDay" ADD CONSTRAINT "InviteActiveDay_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "InviteRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "InviteRedemption" ADD CONSTRAINT "InviteRedemption_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "InviteRedemption" ADD CONSTRAINT "InviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "InviteRedemption" ADD CONSTRAINT "InviteRedemption_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ReminderNudge" ADD CONSTRAINT "ReminderNudge_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ReminderNudge" ADD CONSTRAINT "ReminderNudge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RewardGrant" ADD CONSTRAINT "RewardGrant_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
INSERT INTO "User" ("id", "email", "userTag", "role", "status", "subscriptionStatus", "aiUsageCount", "aiUsageResetAt", "createdAt", "updatedAt") VALUES ('cm1deletedcommentauthor000001', 'system:deleted-comment-author', '_DELETED', 'USER', 'LOCKED', 'FREE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

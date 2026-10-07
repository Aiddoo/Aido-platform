#!/usr/bin/env -S node
import {
	Migration,
	MigrationCLI,
	rawSql,
	checkExpression,
	col,
	fn,
	lit,
	primaryKey,
} from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/29c3be7e84f508333e32dac4053ecc7d16a0957f26b5208a36e7378e45d36685/contract.d.js";
import endContract from "../../snapshots/29c3be7e84f508333e32dac4053ecc7d16a0957f26b5208a36e7378e45d36685/contract.json" with { type: "json" };

export default class M extends Migration<never, End> {
	override readonly endContractJson = endContract;

	override get operations() {
		return [
			this.createSchema({ schema: "public" }),
			this.createNativeEnumType({
				schema: "public",
				typeName: "AccountProvider",
				members: ["CREDENTIAL", "KAKAO", "APPLE", "GOOGLE", "NAVER"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "FollowStatus",
				members: ["PENDING", "ACCEPTED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "NotificationActionType",
				members: ["DEEP_LINK", "BROWSER", "WEBVIEW", "NONE"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "NotificationPurpose",
				members: ["TRANSACTIONAL", "SCHEDULED_SERVICE", "ENGAGEMENT"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "NotificationType",
				members: [
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
				],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "NudgeReplyKind",
				members: ["STARTING", "THANKFUL", "LATER"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "Platform",
				members: ["IOS", "ANDROID"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "PushDeliveryMode",
				members: ["SINGLE", "BATCH"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "PushDeliveryStatus",
				members: ["PENDING", "TICKET_ACCEPTED", "DELIVERED", "FAILED", "UNKNOWN"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "PushDispatchOutboxStatus",
				members: ["PENDING", "PROCESSING", "PUBLISHED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "PushDispatchStatus",
				members: ["PENDING", "PROCESSING", "SENT", "SKIPPED", "FAILED", "HOLDOUT"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "PushRateLimitPhase",
				members: ["GENERAL", "ENGAGEMENT"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "ReportType",
				members: ["WEEKLY", "MONTHLY"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "RetentionExperimentStageName",
				members: ["D0", "D1", "D3", "D7"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "RetentionExperimentStageStatus",
				members: ["SCHEDULED", "SKIPPED", "OUTBOXED", "EVALUATED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "RetentionExperimentVariant",
				members: ["CONTROL", "TREATMENT"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "RetentionOutboxStatus",
				members: ["PENDING", "PROCESSING", "PUBLISHED", "FAILED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "SecurityEvent",
				members: [
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
				],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "SubscriptionStatus",
				members: ["FREE", "ACTIVE", "EXPIRED", "CANCELLED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "SuggestionStatus",
				members: ["PENDING", "ACCEPTED", "DISMISSED"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "TimeFormat",
				members: ["TWELVE_HOUR", "TWENTY_FOUR_HOUR"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "TodoVisibility",
				members: ["PUBLIC", "PRIVATE"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "UserRole",
				members: ["USER", "ADMIN"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "UserStatus",
				members: ["ACTIVE", "LOCKED", "SUSPENDED", "PENDING_VERIFY"],
			}),
			this.createNativeEnumType({
				schema: "public",
				typeName: "VerificationType",
				members: ["EMAIL_VERIFY", "PASSWORD_RESET", "PASSWORD_SETUP"],
			}),
			this.createTable({
				schema: "public",
				table: "Account",
				columns: [
					col("accessToken", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("accessTokenExpiresAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("password", "character varying(128)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 128 } },
					}),
					col("provider", '"AccountProvider"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "AccountProvider" } },
					}),
					col("providerAccountId", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("refreshToken", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("scope", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Account_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "AiReport",
				columns: [
					col("aiSummary", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("aiTips", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("categoryBreakdown", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("dayPatterns", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("generatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("hasActivity", "bool", { notNull: true, codecRef: { codecId: "pg/bool@1" } }),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("locale", "character varying(10)", {
						notNull: true,
						default: lit("ko"),
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 10 } },
					}),
					col("period", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("stats", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("timePatterns", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("type", '"ReportType"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "ReportType" } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("year", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "AiReport_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Cheer",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("message", "character varying(200)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("readAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("receiverId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("senderId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Cheer_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "DailyCompletion",
				columns: [
					col("achievedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("completedTodos", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("date", "date", { notNull: true, codecRef: { codecId: "pg/date-string@1" } }),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("totalTodos", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "DailyCompletion_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Follow",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("followerId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("followingId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("sortOrder", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("status", '"FollowStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "FollowStatus" } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "Follow_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "LoginAttempt",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("email", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("failureReason", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("ipAddress", "character varying(45)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 45 } },
					}),
					col("provider", '"AccountProvider"', {
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "AccountProvider" } },
					}),
					col("success", "bool", { notNull: true, codecRef: { codecId: "pg/bool@1" } }),
					col("userAgent", "character varying(500)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "LoginAttempt_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Memo",
				columns: [
					col("content", "character varying(5000)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 5000 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("isPinned", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("sortOrder", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Memo_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Notification",
				columns: [
					col("actionType", '"NotificationActionType"', {
						notNull: true,
						default: lit("DEEP_LINK"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "NotificationActionType" } },
					}),
					col("actionUrl", "character varying(1000)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 1000 } },
					}),
					col("body", "character varying(500)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("campaignKey", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("cheerId", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("friendId", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("isRead", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("metadata", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
					col("notificationDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
					col("nudgeId", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("openedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("purpose", '"NotificationPurpose"', {
						notNull: true,
						default: lit("TRANSACTIONAL"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "NotificationPurpose" } },
					}),
					col("readAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("title", "character varying(200)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("todoId", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("type", '"NotificationType"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "NotificationType" } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("variantId", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
				],
				constraints: [
					primaryKey(["id"], { name: "Notification_pkey" }),
					checkExpression(
						"Notification_todo_comment_action_url_check",
						'((type <> \'TODO_SHARED\'::"NotificationType") OR ("actionType" <> \'DEEP_LINK\'::"NotificationActionType") OR ((metadata ->> \'commentId\'::text) IS NULL) OR ("actionUrl" IS NULL))',
					),
					checkExpression(
						"Notification_todo_comment_sender_check",
						"(((metadata ->> 'commentId'::text) IS NULL) OR COALESCE(((jsonb_typeof((metadata -> 'senderId'::text)) = 'string'::text) AND (length((metadata ->> 'senderId'::text)) > 0)), false))",
					),
				],
			}),
			this.createTable({
				schema: "public",
				table: "Nudge",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("message", "character varying(200)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("readAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("receiverId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("repliedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("replyKind", '"NudgeReplyKind"', {
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "NudgeReplyKind" } },
					}),
					col("replyUpdatedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("senderId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("thankedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("todoId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Nudge_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "OAuthState",
				columns: [
					col("accessToken", "character varying(1000)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 1000 } },
					}),
					col("accountRestored", "bool", { codecRef: { codecId: "pg/bool@1" } }),
					col("codeVerifier", "character varying(128)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 128 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("exchangeCode", "character varying(64)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("exchangedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("expiresAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("initiatingUserId", "character varying(36)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 36 } },
					}),
					col("ipAddress", "character varying(45)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 45 } },
					}),
					col("mode", "character varying(10)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 10 } },
					}),
					col("profileImage", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("provider", '"AccountProvider"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "AccountProvider" } },
					}),
					col("redirectUri", "character varying(500)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("refreshToken", "character varying(1000)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 1000 } },
					}),
					col("state", "character varying(64)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("userAgent", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("userId", "character varying(255)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("userName", "character varying(20)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 20 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "OAuthState_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "PushDailyBudget",
				columns: [
					col("automatedCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("lastSentAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("localDate", "date", { notNull: true, codecRef: { codecId: "pg/date-string@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "PushDailyBudget_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "PushDeliveryAttempt",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("dispatchId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("errorCode", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("errorMessage", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("expoTicketId", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("pushTokenId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("receiptCheckedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("status", '"PushDeliveryStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PushDeliveryStatus" } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "PushDeliveryAttempt_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "PushDispatch",
				columns: [
					col("campaignKey", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deliveryAttemptCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("lastError", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("localDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
					col("notificationId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("openedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("processingJobAttempt", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("processingJobId", "character varying(255)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("processingStartedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("purpose", '"NotificationPurpose"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "NotificationPurpose" } },
					}),
					col("rateLimitReservedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("scheduledAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("sentAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("skipReason", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("status", '"PushDispatchStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PushDispatchStatus" } },
					}),
					col("timezone", "character varying(50)", {
						notNull: true,
						default: lit("UTC"),
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 50 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("variantId", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "PushDispatch_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "PushDispatchOutbox",
				columns: [
					col("availableAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deliveryMode", '"PushDeliveryMode"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PushDeliveryMode" } },
					}),
					col("dispatchId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("force", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("lastError", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("lockedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("publishAttempts", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("publishedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("status", '"PushDispatchOutboxStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: {
							codecId: "pg/enum@1",
							typeParams: { typeName: "PushDispatchOutboxStatus" },
						},
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["dispatchId"], { name: "PushDispatchOutbox_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "PushRateLimitReservation",
				columns: [
					col("dispatchId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("localDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
					col("phase", '"PushRateLimitPhase"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PushRateLimitPhase" } },
					}),
					col("reservedAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [
					primaryKey(["dispatchId", "phase"], { name: "PushRateLimitReservation_pkey" }),
				],
			}),
			this.createTable({
				schema: "public",
				table: "PushToken",
				columns: [
					col("appVersion", "character varying(30)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 30 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deviceId", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("isActive", "bool", {
						notNull: true,
						default: lit(true),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("lastUsedAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("payloadVersion", "int4", {
						notNull: true,
						default: lit(1),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("platform", '"Platform"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "Platform" } },
					}),
					col("token", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "PushToken_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "RecurringSuggestion",
				columns: [
					col("confidence", "float8", { notNull: true, codecRef: { codecId: "pg/float8@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("daysOfWeek", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("expiresAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("matchedTodos", "jsonb", { notNull: true, codecRef: { codecId: "pg/jsonb@1" } }),
					col("reason", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("scheduledTime", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("status", '"SuggestionStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "SuggestionStatus" } },
					}),
					col("suggestedCategoryId", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("title", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "RecurringSuggestion_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "ReminderNudge",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("message", "character varying(200)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("receiverId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("senderId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "ReminderNudge_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "RetentionExperimentAssignment",
				columns: [
					col("assignedAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("experimentKey", "character varying(100)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("startedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("variant", '"RetentionExperimentVariant"', {
						notNull: true,
						codecRef: {
							codecId: "pg/enum@1",
							typeParams: { typeName: "RetentionExperimentVariant" },
						},
					}),
				],
				constraints: [primaryKey(["id"], { name: "RetentionExperimentAssignment_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "RetentionExperimentResult",
				columns: [
					col("assignmentId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("measuredAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("returnedWithinD7", "bool", { notNull: true, codecRef: { codecId: "pg/bool@1" } }),
					col("todoActionWithinD7", "bool", { notNull: true, codecRef: { codecId: "pg/bool@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "RetentionExperimentResult_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "RetentionExperimentStage",
				columns: [
					col("assignmentId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("notificationId", "int4", { codecRef: { codecId: "pg/int4@1" } }),
					col("processedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("skipReason", "character varying(100)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("stage", '"RetentionExperimentStageName"', {
						notNull: true,
						codecRef: {
							codecId: "pg/enum@1",
							typeParams: { typeName: "RetentionExperimentStageName" },
						},
					}),
					col("status", '"RetentionExperimentStageStatus"', {
						notNull: true,
						default: lit("SCHEDULED"),
						codecRef: {
							codecId: "pg/enum@1",
							typeParams: { typeName: "RetentionExperimentStageStatus" },
						},
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "RetentionExperimentStage_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "RetentionPushOutbox",
				columns: [
					col("attempts", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("availableAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("dispatchId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("lastError", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("lockedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("notificationId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("publishedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("stageId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("status", '"RetentionOutboxStatus"', {
						notNull: true,
						default: lit("PENDING"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "RetentionOutboxStatus" } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "RetentionPushOutbox_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "SecurityLog",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("event", '"SecurityEvent"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "SecurityEvent" } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("ipAddress", "character varying(45)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 45 } },
					}),
					col("metadata", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
					col("userAgent", "character varying(500)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("userId", "text", { codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "SecurityLog_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Session",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deviceFingerprint", "character varying(64)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("expiresAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("ipAddress", "character varying(45)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 45 } },
					}),
					col("lastUsedAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("previousTokenHash", "character varying(64)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("refreshTokenHash", "character varying(64)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("revokedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("revokedReason", "character varying(200)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("tokenFamily", "character varying(36)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 36 } },
					}),
					col("tokenVersion", "int4", {
						notNull: true,
						default: lit(1),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userAgent", "character varying(500)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Session_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Subscription",
				columns: [
					col("cancelledAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("dataRetentionUntil", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deletedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("expiresAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("lastProcessedEventId", "character varying(255)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("productId", "character varying(100)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
					}),
					col("revenueCatId", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("startedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("status", '"SubscriptionStatus"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "SubscriptionStatus" } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Subscription_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Todo",
				columns: [
					col("categoryId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("commentCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("completed", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("completedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("endDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("isAllDay", "bool", {
						notNull: true,
						default: lit(true),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("recurrenceGroupId", "character varying(36)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 36 } },
					}),
					col("scheduledTime", "timestamptz(3)", {
						codecRef: { codecId: "pg/timestamptz-temporal@1", typeParams: { precision: 3 } },
					}),
					col("sortOrder", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("startDate", "date", { notNull: true, codecRef: { codecId: "pg/date-string@1" } }),
					col("title", "character varying(200)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("viewCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("visibility", '"TodoVisibility"', {
						notNull: true,
						default: lit("PUBLIC"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "TodoVisibility" } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "Todo_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "TodoCategory",
				columns: [
					col("color", "character varying(7)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 7 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("name", "character varying(50)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 50 } },
					}),
					col("sortOrder", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "TodoCategory_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "TodoComment",
				columns: [
					col("authorId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("clientRequestId", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
					col("content", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deletedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("depth", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("editedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("likeCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("parentId", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("path", "text[]", {
						notNull: true,
						default: lit([]),
						codecRef: { codecId: "pg/text@1", many: true },
					}),
					col("replyCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("requestFingerprint", "character(64)", {
						codecRef: { codecId: "sql/char@1", typeParams: { length: 64 } },
					}),
					col("rootId", "text", { codecRef: { codecId: "pg/text@1" } }),
					col("todoId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "TodoComment_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "TodoCommentLike",
				columns: [
					col("commentId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("isActive", "bool", {
						notNull: true,
						default: lit(true),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("notifiedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["commentId", "userId"], { name: "TodoCommentLike_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "TodoItem",
				columns: [
					col("completed", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("sortOrder", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("title", "character varying(200)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 200 } },
					}),
					col("todoId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "TodoItem_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "TodoView",
				columns: [
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("todoId", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("viewerId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["todoId", "viewerId"], { name: "TodoView_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "User",
				columns: [
					col("aiUsageCount", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("aiUsageResetAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("deletedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("email", "character varying(255)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("emailVerifiedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("lastActiveAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("lastLoginAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("revenueCatUserId", "character varying(255)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("role", '"UserRole"', {
						notNull: true,
						default: lit("USER"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "UserRole" } },
					}),
					col("status", '"UserStatus"', {
						notNull: true,
						default: lit("PENDING_VERIFY"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "UserStatus" } },
					}),
					col("subscriptionExpiresAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("subscriptionStatus", '"SubscriptionStatus"', {
						notNull: true,
						default: lit("FREE"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "SubscriptionStatus" } },
					}),
					col("twoFactorEnabled", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("twoFactorSecret", "character varying(255)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
					}),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userTag", "character varying(8)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 8 } },
					}),
				],
				constraints: [primaryKey(["id"], { name: "User_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "UserActivityDay",
				columns: [
					col("firstSeenAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("lastSeenAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("localDate", "date", { notNull: true, codecRef: { codecId: "pg/date-string@1" } }),
					col("timezone", "character varying(50)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 50 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "UserActivityDay_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "UserConsent",
				columns: [
					col("agreedTermsVersion", "character varying(20)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 20 } },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("marketingAgreedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("marketingPushAgreedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("privacyAgreedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("termsAgreedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "UserConsent_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "UserLocation",
				columns: [
					col("gridX", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("gridY", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("latitude", "float8", { notNull: true, codecRef: { codecId: "pg/float8@1" } }),
					col("longitude", "float8", { notNull: true, codecRef: { codecId: "pg/float8@1" } }),
					col("updatedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "UserLocation_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "UserPreference",
				columns: [
					col("currentStreak", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("eveningReminderHour", "int4", {
						notNull: true,
						default: lit(19),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("eveningReminderMinute", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("lastCompletedDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
					col("locale", "character varying(10)", {
						notNull: true,
						default: lit("ko"),
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 10 } },
					}),
					col("longestStreak", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("morningReminderHour", "int4", {
						notNull: true,
						default: lit(8),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("morningReminderMinute", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("nightPushEnabled", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("pushEnabled", "bool", {
						notNull: true,
						default: lit(false),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("timeFormat", '"TimeFormat"', {
						notNull: true,
						default: lit("TWELVE_HOUR"),
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "TimeFormat" } },
					}),
					col("timezone", "character varying(50)", {
						notNull: true,
						default: lit("UTC"),
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 50 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("weatherEveningEnabled", "bool", {
						notNull: true,
						default: lit(true),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("weatherEveningHour", "int4", {
						notNull: true,
						default: lit(17),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("weatherEveningMinute", "int4", {
						notNull: true,
						default: lit(30),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("weatherMorningEnabled", "bool", {
						notNull: true,
						default: lit(true),
						codecRef: { codecId: "pg/bool@1" },
					}),
					col("weatherMorningHour", "int4", {
						notNull: true,
						default: lit(7),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("weatherMorningMinute", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
				],
				constraints: [primaryKey(["id"], { name: "UserPreference_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "UserProfile",
				columns: [
					col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("name", "character varying(20)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 20 } },
					}),
					col("profileImage", "character varying(500)", {
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "UserProfile_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "Verification",
				columns: [
					col("attempts", "int4", {
						notNull: true,
						default: lit(0),
						codecRef: { codecId: "pg/int4@1" },
					}),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("expiresAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("token", "character varying(64)", {
						notNull: true,
						codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
					}),
					col("type", '"VerificationType"', {
						notNull: true,
						codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "VerificationType" } },
					}),
					col("usedAt", "timestamp(3)", {
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "Verification_pkey" })],
			}),
			this.createTable({
				schema: "public",
				table: "WeeklyAchievement",
				columns: [
					col("achievedAt", "timestamp(3)", {
						notNull: true,
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("completedTodos", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("createdAt", "timestamp(3)", {
						notNull: true,
						default: fn("now()"),
						codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
					}),
					col("id", "SERIAL", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("totalTodos", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
					col("week", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
					col("year", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
				],
				constraints: [primaryKey(["id"], { name: "WeeklyAchievement_pkey" })],
			}),
			this.createIndex({
				schema: "public",
				table: "Account",
				index: "Account_provider_providerAccountId_key",
				columns: ["provider", "providerAccountId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Account",
				index: "Account_userId_provider_key",
				columns: ["userId", "provider"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "AiReport",
				index: "AiReport_userId_type_generatedAt_idx",
				columns: ["userId", "type", "generatedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "AiReport",
				index: "AiReport_userId_type_idx",
				columns: ["userId", "type"],
			}),
			this.createIndex({
				schema: "public",
				table: "AiReport",
				index: "AiReport_userId_type_year_period_key",
				columns: ["userId", "type", "year", "period"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Cheer",
				index: "Cheer_receiverId_createdAt_idx",
				columns: ["receiverId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Cheer",
				index: "Cheer_senderId_createdAt_idx",
				columns: ["senderId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Cheer",
				index: "Cheer_senderId_receiverId_createdAt_idx",
				columns: ["senderId", "receiverId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "DailyCompletion",
				index: "DailyCompletion_userId_date_key",
				columns: ["userId", "date"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Follow",
				index: "Follow_followerId_followingId_key",
				columns: ["followerId", "followingId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Follow",
				index: "Follow_followerId_sortOrder_idx",
				columns: ["followerId", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "Follow",
				index: "Follow_followerId_status_idx",
				columns: ["followerId", "status"],
			}),
			this.createIndex({
				schema: "public",
				table: "Follow",
				index: "Follow_followingId_status_idx",
				columns: ["followingId", "status"],
			}),
			this.createIndex({
				schema: "public",
				table: "LoginAttempt",
				index: "LoginAttempt_createdAt_idx",
				columns: ["createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "LoginAttempt",
				index: "LoginAttempt_email_createdAt_idx",
				columns: ["email", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "LoginAttempt",
				index: "LoginAttempt_ipAddress_createdAt_idx",
				columns: ["ipAddress", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "LoginAttempt",
				index: "LoginAttempt_provider_createdAt_idx",
				columns: ["provider", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Memo",
				index: "Memo_userId_isPinned_sortOrder_idx",
				columns: ["userId", "isPinned", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "Memo",
				index: "Memo_userId_sortOrder_idx",
				columns: ["userId", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_comment_actor_cleanup_idx",
				expression: "(metadata ->> 'senderId'::text)",
				extras: { where: "((metadata ->> 'senderId'::text) IS NOT NULL)" },
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_createdAt_idx",
				columns: ["createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_friend_actor_cleanup_idx",
				columns: ["friendId"],
				extras: { where: '("friendId" IS NOT NULL)' },
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_todoId_type_createdAt_idx",
				columns: ["todoId", "type", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_todo_reminder_dedup",
				expression: "\"todoId\", type, (metadata ->> 'stage'::text)",
				extras: {
					where: '((type = \'TODO_REMINDER\'::"NotificationType") AND ("todoId" IS NOT NULL))',
					unique: true,
				},
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_userId_createdAt_id_idx",
				columns: ["userId", "createdAt", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_userId_isRead_createdAt_idx",
				columns: ["userId", "isRead", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_userId_type_idx",
				columns: ["userId", "type"],
			}),
			this.createIndex({
				schema: "public",
				table: "Notification",
				index: "Notification_userId_type_notificationDate_idx",
				columns: ["userId", "type", "notificationDate"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_receiverId_createdAt_idx",
				columns: ["receiverId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_receiverId_id_idx",
				columns: ["receiverId", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_senderId_createdAt_idx",
				columns: ["senderId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_senderId_id_idx",
				columns: ["senderId", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_senderId_todoId_createdAt_idx",
				columns: ["senderId", "todoId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_thanked_sender_per_todo",
				columns: ["todoId", "senderId"],
				extras: { where: '("thankedAt" IS NOT NULL)', unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_todoId_idx",
				columns: ["todoId"],
			}),
			this.createIndex({
				schema: "public",
				table: "Nudge",
				index: "Nudge_todoId_receiverId_thankedAt_id_idx",
				columns: ["todoId", "receiverId", "thankedAt", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "OAuthState",
				index: "OAuthState_exchangeCode_key",
				columns: ["exchangeCode"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "OAuthState",
				index: "OAuthState_expiresAt_idx",
				columns: ["expiresAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "OAuthState",
				index: "OAuthState_state_key",
				columns: ["state"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDailyBudget",
				index: "PushDailyBudget_userId_localDate_key",
				columns: ["userId", "localDate"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDeliveryAttempt",
				index: "PushDeliveryAttempt_dispatchId_pushTokenId_key",
				columns: ["dispatchId", "pushTokenId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDeliveryAttempt",
				index: "PushDeliveryAttempt_expoTicketId_key",
				columns: ["expoTicketId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDeliveryAttempt",
				index: "PushDeliveryAttempt_status_createdAt_idx",
				columns: ["status", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatch",
				index: "PushDispatch_campaignKey_status_createdAt_idx",
				columns: ["campaignKey", "status", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatch",
				index: "PushDispatch_notificationId_key",
				columns: ["notificationId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatch",
				index: "PushDispatch_processing_lease_idx",
				columns: ["processingStartedAt"],
				extras: { where: "(status = 'PROCESSING'::\"PushDispatchStatus\")" },
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatch",
				index: "PushDispatch_status_scheduledAt_idx",
				columns: ["status", "scheduledAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatch",
				index: "PushDispatch_userId_localDate_purpose_idx",
				columns: ["userId", "localDate", "purpose"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatchOutbox",
				index: "PushDispatchOutbox_status_availableAt_dispatchId_idx",
				columns: ["status", "availableAt", "dispatchId"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushDispatchOutbox",
				index: "PushDispatchOutbox_status_lockedAt_idx",
				columns: ["status", "lockedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushRateLimitReservation",
				index: "PushRateLimitReservation_phase_userId_localDate_reservedAt_idx",
				columns: ["phase", "userId", "localDate", "reservedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushRateLimitReservation",
				index: "PushRateLimitReservation_phase_userId_reservedAt_idx",
				columns: ["phase", "userId", "reservedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "PushToken",
				index: "PushToken_token_key",
				columns: ["token"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushToken",
				index: "PushToken_userId_deviceId_key",
				columns: ["userId", "deviceId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "PushToken",
				index: "PushToken_userId_isActive_idx",
				columns: ["userId", "isActive"],
			}),
			this.createIndex({
				schema: "public",
				table: "RecurringSuggestion",
				index: "RecurringSuggestion_userId_expiresAt_idx",
				columns: ["userId", "expiresAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "RecurringSuggestion",
				index: "RecurringSuggestion_userId_status_idx",
				columns: ["userId", "status"],
			}),
			this.createIndex({
				schema: "public",
				table: "RecurringSuggestion",
				index: "RecurringSuggestion_userId_updatedAt_idx",
				columns: ["userId", "updatedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "ReminderNudge",
				index: "ReminderNudge_receiverId_createdAt_idx",
				columns: ["receiverId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "ReminderNudge",
				index: "ReminderNudge_senderId_receiverId_createdAt_idx",
				columns: ["senderId", "receiverId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentAssignment",
				index: "RetentionExperimentAssignment_experimentKey_variant_startedAt_i",
				columns: ["experimentKey", "variant", "startedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentAssignment",
				index: "RetentionExperimentAssignment_userId_experimentKey_key",
				columns: ["userId", "experimentKey"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentResult",
				index: "RetentionExperimentResult_assignmentId_key",
				columns: ["assignmentId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentResult",
				index: "RetentionExperimentResult_measuredAt_idx",
				columns: ["measuredAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentStage",
				index: "RetentionExperimentStage_assignmentId_stage_key",
				columns: ["assignmentId", "stage"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentStage",
				index: "RetentionExperimentStage_notificationId_key",
				columns: ["notificationId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionExperimentStage",
				index: "RetentionExperimentStage_status_stage_createdAt_idx",
				columns: ["status", "stage", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionPushOutbox",
				index: "RetentionPushOutbox_dispatchId_key",
				columns: ["dispatchId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionPushOutbox",
				index: "RetentionPushOutbox_notificationId_key",
				columns: ["notificationId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionPushOutbox",
				index: "RetentionPushOutbox_stageId_key",
				columns: ["stageId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionPushOutbox",
				index: "RetentionPushOutbox_status_availableAt_id_idx",
				columns: ["status", "availableAt", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "RetentionPushOutbox",
				index: "RetentionPushOutbox_status_lockedAt_idx",
				columns: ["status", "lockedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "SecurityLog",
				index: "SecurityLog_event_createdAt_idx",
				columns: ["event", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "SecurityLog",
				index: "SecurityLog_ipAddress_createdAt_idx",
				columns: ["ipAddress", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "SecurityLog",
				index: "SecurityLog_userId_createdAt_idx",
				columns: ["userId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Session",
				index: "Session_expiresAt_idx",
				columns: ["expiresAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Session",
				index: "Session_refreshTokenHash_key",
				columns: ["refreshTokenHash"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Session",
				index: "Session_tokenFamily_idx",
				columns: ["tokenFamily"],
			}),
			this.createIndex({
				schema: "public",
				table: "Session",
				index: "Session_userId_idx",
				columns: ["userId"],
			}),
			this.createIndex({
				schema: "public",
				table: "Subscription",
				index: "Subscription_deletedAt_idx",
				columns: ["deletedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Subscription",
				index: "Subscription_revenueCatId_key",
				columns: ["revenueCatId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Subscription",
				index: "Subscription_status_expiresAt_idx",
				columns: ["status", "expiresAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "Subscription",
				index: "Subscription_userId_idx",
				columns: ["userId"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_completed_scheduledTime_idx",
				columns: ["completed", "scheduledTime"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_recurrenceGroupId_idx",
				columns: ["recurrenceGroupId"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_userId_categoryId_idx",
				columns: ["userId", "categoryId"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_userId_completed_startDate_idx",
				columns: ["userId", "completed", "startDate"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_userId_sortOrder_idx",
				columns: ["userId", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "Todo",
				index: "Todo_userId_startDate_endDate_idx",
				columns: ["userId", "startDate", "endDate"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoCategory",
				index: "TodoCategory_userId_name_key",
				columns: ["userId", "name"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "TodoCategory",
				index: "TodoCategory_userId_sortOrder_idx",
				columns: ["userId", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoComment",
				index: "TodoComment_authorId_clientRequestId_key",
				columns: ["authorId", "clientRequestId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "TodoComment",
				index: "TodoComment_todoId_parentId_createdAt_id_idx",
				columns: ["todoId", "parentId", "createdAt", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoComment",
				index: "TodoComment_todoId_parentId_likeCount_replyCount_createdAt__idx",
				columns: ["todoId", "parentId", "likeCount", "replyCount", "createdAt", "id"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoComment",
				index: "TodoComment_todoId_rootId_idx",
				columns: ["todoId", "rootId"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoCommentLike",
				index: "TodoCommentLike_userId_isActive_idx",
				columns: ["userId", "isActive"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoItem",
				index: "TodoItem_todoId_sortOrder_idx",
				columns: ["todoId", "sortOrder"],
			}),
			this.createIndex({
				schema: "public",
				table: "TodoView",
				index: "TodoView_viewerId_createdAt_idx",
				columns: ["viewerId", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_deletedAt_createdAt_idx",
				columns: ["deletedAt", "createdAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_deletedAt_idx",
				columns: ["deletedAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_deletedAt_lastActiveAt_idx",
				columns: ["deletedAt", "lastActiveAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_email_key",
				columns: ["email"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_revenueCatUserId_key",
				columns: ["revenueCatUserId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_status_deletedAt_lastLoginAt_idx",
				columns: ["status", "deletedAt", "lastLoginAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_status_idx",
				columns: ["status"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_subscriptionStatus_idx",
				columns: ["subscriptionStatus"],
			}),
			this.createIndex({
				schema: "public",
				table: "User",
				index: "User_userTag_key",
				columns: ["userTag"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "UserActivityDay",
				index: "UserActivityDay_firstSeenAt_idx",
				columns: ["firstSeenAt"],
			}),
			this.createIndex({
				schema: "public",
				table: "UserActivityDay",
				index: "UserActivityDay_localDate_idx",
				columns: ["localDate"],
			}),
			this.createIndex({
				schema: "public",
				table: "UserActivityDay",
				index: "UserActivityDay_userId_localDate_key",
				columns: ["userId", "localDate"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "UserConsent",
				index: "UserConsent_userId_key",
				columns: ["userId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "UserLocation",
				index: "UserLocation_userId_key",
				columns: ["userId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_pushEnabled_timezone_eveningReminderHour_eve_idx",
				columns: ["pushEnabled", "timezone", "eveningReminderHour", "eveningReminderMinute"],
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_pushEnabled_timezone_idx",
				columns: ["pushEnabled", "timezone"],
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_pushEnabled_timezone_morningReminderHour_mor_idx",
				columns: ["pushEnabled", "timezone", "morningReminderHour", "morningReminderMinute"],
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_pushEnabled_weatherEveningEnabled_timezone_w_idx",
				columns: [
					"pushEnabled",
					"weatherEveningEnabled",
					"timezone",
					"weatherEveningHour",
					"weatherEveningMinute",
				],
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_pushEnabled_weatherMorningEnabled_timezone_w_idx",
				columns: [
					"pushEnabled",
					"weatherMorningEnabled",
					"timezone",
					"weatherMorningHour",
					"weatherMorningMinute",
				],
			}),
			this.createIndex({
				schema: "public",
				table: "UserPreference",
				index: "UserPreference_userId_key",
				columns: ["userId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "UserProfile",
				index: "UserProfile_userId_key",
				columns: ["userId"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Verification",
				index: "Verification_token_key",
				columns: ["token"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "Verification",
				index: "Verification_userId_type_idx",
				columns: ["userId", "type"],
			}),
			this.createIndex({
				schema: "public",
				table: "WeeklyAchievement",
				index: "WeeklyAchievement_userId_year_idx",
				columns: ["userId", "year"],
			}),
			this.createIndex({
				schema: "public",
				table: "WeeklyAchievement",
				index: "WeeklyAchievement_userId_year_week_key",
				columns: ["userId", "year", "week"],
				extras: { unique: true },
			}),
			this.createIndex({
				schema: "public",
				table: "WeeklyAchievement",
				index: "WeeklyAchievement_year_week_idx",
				columns: ["year", "week"],
			}),
			this.addForeignKey({
				schema: "public",
				table: "Account",
				foreignKey: {
					name: "Account_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "AiReport",
				foreignKey: {
					name: "AiReport_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Cheer",
				foreignKey: {
					name: "Cheer_receiverId_fkey",
					columns: ["receiverId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Cheer",
				foreignKey: {
					name: "Cheer_senderId_fkey",
					columns: ["senderId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "DailyCompletion",
				foreignKey: {
					name: "DailyCompletion_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Follow",
				foreignKey: {
					name: "Follow_followerId_fkey",
					columns: ["followerId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Follow",
				foreignKey: {
					name: "Follow_followingId_fkey",
					columns: ["followingId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Memo",
				foreignKey: {
					name: "Memo_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Notification",
				foreignKey: {
					name: "Notification_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Nudge",
				foreignKey: {
					name: "Nudge_receiverId_fkey",
					columns: ["receiverId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Nudge",
				foreignKey: {
					name: "Nudge_senderId_fkey",
					columns: ["senderId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Nudge",
				foreignKey: {
					name: "Nudge_todoId_fkey",
					columns: ["todoId"],
					references: { schema: "public", table: "Todo", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDailyBudget",
				foreignKey: {
					name: "PushDailyBudget_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDeliveryAttempt",
				foreignKey: {
					name: "PushDeliveryAttempt_dispatchId_fkey",
					columns: ["dispatchId"],
					references: { schema: "public", table: "PushDispatch", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDeliveryAttempt",
				foreignKey: {
					name: "PushDeliveryAttempt_pushTokenId_fkey",
					columns: ["pushTokenId"],
					references: { schema: "public", table: "PushToken", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDispatch",
				foreignKey: {
					name: "PushDispatch_notificationId_fkey",
					columns: ["notificationId"],
					references: { schema: "public", table: "Notification", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDispatch",
				foreignKey: {
					name: "PushDispatch_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushDispatchOutbox",
				foreignKey: {
					name: "PushDispatchOutbox_dispatchId_fkey",
					columns: ["dispatchId"],
					references: { schema: "public", table: "PushDispatch", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushRateLimitReservation",
				foreignKey: {
					name: "PushRateLimitReservation_dispatchId_fkey",
					columns: ["dispatchId"],
					references: { schema: "public", table: "PushDispatch", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "PushToken",
				foreignKey: {
					name: "PushToken_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "RecurringSuggestion",
				foreignKey: {
					name: "RecurringSuggestion_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "ReminderNudge",
				foreignKey: {
					name: "ReminderNudge_receiverId_fkey",
					columns: ["receiverId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "ReminderNudge",
				foreignKey: {
					name: "ReminderNudge_senderId_fkey",
					columns: ["senderId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "RetentionExperimentAssignment",
				foreignKey: {
					name: "RetentionExperimentAssignment_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "RetentionExperimentResult",
				foreignKey: {
					name: "RetentionExperimentResult_assignmentId_fkey",
					columns: ["assignmentId"],
					references: { schema: "public", table: "RetentionExperimentAssignment", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "RetentionExperimentStage",
				foreignKey: {
					name: "RetentionExperimentStage_assignmentId_fkey",
					columns: ["assignmentId"],
					references: { schema: "public", table: "RetentionExperimentAssignment", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "RetentionPushOutbox",
				foreignKey: {
					name: "RetentionPushOutbox_stageId_fkey",
					columns: ["stageId"],
					references: { schema: "public", table: "RetentionExperimentStage", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "SecurityLog",
				foreignKey: {
					name: "SecurityLog_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "setNull",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Session",
				foreignKey: {
					name: "Session_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Subscription",
				foreignKey: {
					name: "Subscription_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Todo",
				foreignKey: {
					name: "Todo_categoryId_fkey",
					columns: ["categoryId"],
					references: { schema: "public", table: "TodoCategory", columns: ["id"] },
					onDelete: "restrict",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Todo",
				foreignKey: {
					name: "Todo_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoCategory",
				foreignKey: {
					name: "TodoCategory_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoComment",
				foreignKey: {
					name: "TodoComment_authorId_fkey",
					columns: ["authorId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "restrict",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoComment",
				foreignKey: {
					name: "TodoComment_parentId_fkey",
					columns: ["parentId"],
					references: { schema: "public", table: "TodoComment", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoComment",
				foreignKey: {
					name: "TodoComment_todoId_fkey",
					columns: ["todoId"],
					references: { schema: "public", table: "Todo", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoCommentLike",
				foreignKey: {
					name: "TodoCommentLike_commentId_fkey",
					columns: ["commentId"],
					references: { schema: "public", table: "TodoComment", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoCommentLike",
				foreignKey: {
					name: "TodoCommentLike_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "restrict",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoItem",
				foreignKey: {
					name: "TodoItem_todoId_fkey",
					columns: ["todoId"],
					references: { schema: "public", table: "Todo", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoView",
				foreignKey: {
					name: "TodoView_todoId_fkey",
					columns: ["todoId"],
					references: { schema: "public", table: "Todo", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "TodoView",
				foreignKey: {
					name: "TodoView_viewerId_fkey",
					columns: ["viewerId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "UserActivityDay",
				foreignKey: {
					name: "UserActivityDay_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "UserConsent",
				foreignKey: {
					name: "UserConsent_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "UserLocation",
				foreignKey: {
					name: "UserLocation_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "UserPreference",
				foreignKey: {
					name: "UserPreference_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "UserProfile",
				foreignKey: {
					name: "UserProfile_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "Verification",
				foreignKey: {
					name: "Verification_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			this.addForeignKey({
				schema: "public",
				table: "WeeklyAchievement",
				foreignKey: {
					name: "WeeklyAchievement_userId_fkey",
					columns: ["userId"],
					references: { schema: "public", table: "User", columns: ["id"] },
					onDelete: "cascade",
					onUpdate: "cascade",
				},
			}),
			rawSql({
				id: "seed.deletedCommentAuthor",
				label: "Create the locked author used by anonymized comments",
				operationClass: "widening",
				target: {
					id: "postgres",
					details: { schema: "public", objectType: "table", name: "User" },
				},
				precheck: [],
				execute: [
					{
						description: "Create the reserved author without replacing any existing user",
						sql: `INSERT INTO "public"."User" ("id", "email", "userTag", "role", "status", "subscriptionStatus", "aiUsageCount", "aiUsageResetAt", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, 'USER', 'LOCKED', 'FREE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING`,
						params: ["cm1deletedcommentauthor000001", "system:deleted-comment-author", "_DELETED"],
					},
				],
				postcheck: [
					{
						description: "The reserved author must be locked and have no login account",
						sql: `SELECT EXISTS (SELECT 1 FROM "public"."User" u WHERE u.id = $1 AND u.email = $2 AND u."userTag" = $3
            AND u.status = 'LOCKED' AND u."deletedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "public"."Account" a WHERE a."userId" = u.id)) AS "result"`,
						params: ["cm1deletedcommentauthor000001", "system:deleted-comment-author", "_DELETED"],
					},
				],
			}),
		];
	}
}

MigrationCLI.run(import.meta.url, M);

import { z } from "zod";

import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

/** 알림 큐의 이름·메시지 스키마·운영 정책을 소유하는 단일 계약. */

// =============================================================================
// Queue Name
// =============================================================================

export const NOTIFICATION_QUEUE = "notification.v1";
export const NOTIFICATION_LEGACY_QUEUE = "notification";

// =============================================================================
// Job Names
// =============================================================================

/** 알림 잡 이름 상수 */
export const NotificationJobName = {
	FOLLOW_NEW: "follow-new",
	FOLLOW_MUTUAL: "follow-mutual",
	NUDGE_SENT: "nudge-sent",
	CHEER_SENT: "cheer-sent",
	BILLING_ISSUE: "billing-issue",
	FRIEND_COMPLETED: "friend-completed",
	MILESTONE_REACHED: "milestone-reached",
	PUSH_RECEIPTS: "push-receipts",
} as const;

/** 기존 재시도·보관 계약. JobRuntime이 각 backend 옵션으로 변환한다. */
export const NOTIFICATION_JOB_POLICY = {
	retryLimit: 2,
	retryDelaySeconds: 1,
	retryBackoff: true,
	expireInSeconds: 5 * 60,
	retentionSeconds: 7 * 24 * 60 * 60,
	deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const NOTIFICATION_WORKER_POLICY = {
	teamSize: 5,
	pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
} as const;

export const PUSH_RECEIPT_SCHEDULE = {
	key: "push-receipts-scheduler",
	cron: "*/5 * * * *",
} as const;

// =============================================================================
// Job Data Interfaces
// =============================================================================

/**
 * 새 팔로우 요청 잡 데이터
 */
const FollowNewJobDataSchema = z.object({
	followerId: z.string().min(1),
	followingId: z.string().min(1),
	followerName: z.string(),
});

/**
 * 맞팔로우 성립 잡 데이터
 */
const FollowMutualJobDataSchema = z.object({
	userId: z.string().min(1),
	friendId: z.string().min(1),
	friendName: z.string(),
});

/**
 * Nudge 발송 잡 데이터
 */
const NudgeSentJobDataSchema = z.object({
	nudgeId: z.number().int(),
	senderId: z.string().min(1),
	receiverId: z.string().min(1),
	senderName: z.string(),
	todoId: z.number().int().optional(),
	todoTitle: z.string().optional(),
	message: z.string().optional(),
});

/**
 * Cheer 발송 잡 데이터
 */
const CheerSentJobDataSchema = z.object({
	cheerId: z.number().int(),
	senderId: z.string().min(1),
	receiverId: z.string().min(1),
	senderName: z.string(),
	message: z.string().optional(),
});

/**
 * 결제 문제 잡 데이터
 */
const BillingIssueJobDataSchema = z.object({ userId: z.string().min(1) });

/**
 * 친구 할일 전체 완료 잡 데이터
 */
const FriendCompletedJobDataSchema = z.object({
	friendId: z.string().min(1),
	friendName: z.string(),
	notifyUserIds: z.array(z.string().min(1)),
	timezone: z.string().min(1),
});

/**
 * 마일스톤 달성 잡 데이터
 */
const MilestoneReachedJobDataSchema = z.object({
	userId: z.string().min(1),
	milestone: z.enum([
		"FIRST_COMPLETE",
		"COUNT_10",
		"COUNT_50",
		"COUNT_100",
		"STREAK_3",
		"FIRST_FRIEND",
	]),
});

export const NotificationRuntimeJobSchema = z.discriminatedUnion("name", [
	z.object({
		name: z.literal(NotificationJobName.FOLLOW_NEW),
		data: FollowNewJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.FOLLOW_MUTUAL),
		data: FollowMutualJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.NUDGE_SENT),
		data: NudgeSentJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.CHEER_SENT),
		data: CheerSentJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.BILLING_ISSUE),
		data: BillingIssueJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.FRIEND_COMPLETED),
		data: FriendCompletedJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.MILESTONE_REACHED),
		data: MilestoneReachedJobDataSchema,
	}),
	z.object({
		name: z.literal(NotificationJobName.PUSH_RECEIPTS),
		data: z.object({}),
	}),
]);

// =============================================================================
// Schema-derived public types
// =============================================================================

/** 런타임 검증 스키마가 큐 타입 계약의 단일 원본이다. */
export type NotificationRuntimeJob = z.output<typeof NotificationRuntimeJobSchema>;
export type NotificationJobNameValue = NotificationRuntimeJob["name"];
export type NotificationJobOf<Name extends NotificationJobNameValue> = Extract<
	NotificationRuntimeJob,
	{ name: Name }
>;
export type NotificationJobData<Name extends NotificationJobNameValue> =
	NotificationJobOf<Name>["data"];

export type FollowNewJobData = NotificationJobData<typeof NotificationJobName.FOLLOW_NEW>;
export type FollowMutualJobData = NotificationJobData<typeof NotificationJobName.FOLLOW_MUTUAL>;
export type NudgeSentJobData = NotificationJobData<typeof NotificationJobName.NUDGE_SENT>;
export type CheerSentJobData = NotificationJobData<typeof NotificationJobName.CHEER_SENT>;
export type BillingIssueJobData = NotificationJobData<typeof NotificationJobName.BILLING_ISSUE>;
export type FriendCompletedJobData = NotificationJobData<
	typeof NotificationJobName.FRIEND_COMPLETED
>;
export type MilestoneReachedJobData = NotificationJobData<
	typeof NotificationJobName.MILESTONE_REACHED
>;

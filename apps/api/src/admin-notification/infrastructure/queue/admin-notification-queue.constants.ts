/**
 * Admin Notification BullMQ 큐 상수 및 잡 데이터 타입 정의
 */

import { z } from "zod";

import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

import type { AdminNotification } from "../../domain/value-objects/admin-notification-message.vo";

// =============================================================================
// Queue Name
// =============================================================================

export const ADMIN_NOTIFICATION_QUEUE = "admin-notification.v1";
export const ADMIN_NOTIFICATION_LEGACY_QUEUE = "admin-notification";

// =============================================================================
// Job Names
// =============================================================================

/** 잡 이름 상수 */
export const AdminNotificationJobName = {
	DISPATCH_SUMMARY: "dispatch-signup-summary",
	SEND: "send-notification",
} as const;

/** 기존 재시도·보관 계약. JobRuntime이 각 backend 옵션으로 변환한다. */
export const ADMIN_NOTIFICATION_JOB_POLICY = {
	retryLimit: 2,
	retryDelaySeconds: 5,
	retryBackoff: true,
	expireInSeconds: 5 * 60,
	retentionSeconds: 24 * 60 * 60,
	deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const ADMIN_NOTIFICATION_WORKER_POLICY = {
	teamSize: 3,
	pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;

export const DAILY_SIGNUP_SUMMARY_SCHEDULE = {
	key: "daily-signup-summary-scheduler",
	cron: "10 0 * * *",
	timezone: "Asia/Seoul",
	jobPolicy: {
		retryLimit: 2,
		retryDelaySeconds: 1,
		retryBackoff: true,
		expireInSeconds: 5 * 60,
		retentionSeconds: 24 * 60 * 60,
		deleteAfterSeconds: 24 * 60 * 60,
	},
} as const;

// =============================================================================
// Job Data Interfaces
// =============================================================================

/** send-notification 잡 데이터 */
export interface AdminNotificationSendData {
	channel: "admin" | "payment";
	notification: AdminNotification;
}

const AdminNotificationSchema = z.object({
	title: z.string(),
	body: z.string(),
	fields: z
		.array(
			z.object({
				name: z.string(),
				value: z.string(),
				inline: z.boolean().optional(),
			}),
		)
		.optional(),
	color: z.number().optional(),
});

export const AdminNotificationRuntimeJobSchema = z.discriminatedUnion("name", [
	z.object({
		name: z.literal(AdminNotificationJobName.DISPATCH_SUMMARY),
		data: z.object({}),
	}),
	z.object({
		name: z.literal(AdminNotificationJobName.SEND),
		data: z.object({
			channel: z.enum(["admin", "payment"]),
			notification: AdminNotificationSchema,
		}),
	}),
]);

/** 잡 이름 → 데이터 타입 매핑 */
export interface AdminNotificationJobMap {
	[AdminNotificationJobName.DISPATCH_SUMMARY]: Record<string, never>;
	[AdminNotificationJobName.SEND]: AdminNotificationSendData;
}

export type AdminNotificationJobData = AdminNotificationJobMap[keyof AdminNotificationJobMap];

export type AdminNotificationRuntimeJob = z.infer<typeof AdminNotificationRuntimeJobSchema>;

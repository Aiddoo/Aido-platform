/**
 * Admin Notification BullMQ 큐 상수 및 잡 데이터 타입 정의
 */

import type { AdminNotification } from "../providers/admin-notifier.interface";

// =============================================================================
// Queue Name
// =============================================================================

export const ADMIN_NOTIFICATION_QUEUE = "admin-notification";

// =============================================================================
// Job Names
// =============================================================================

/** 잡 이름 상수 */
export const AdminNotificationJobName = {
	DISPATCH_SUMMARY: "dispatch-signup-summary",
	SEND: "send-notification",
} as const;

// =============================================================================
// Job Data Interfaces
// =============================================================================

/** send-notification 잡 데이터 */
export interface AdminNotificationSendData {
	channel: "admin" | "payment";
	notification: AdminNotification;
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AdminNotificationJobMap {
	[AdminNotificationJobName.DISPATCH_SUMMARY]: Record<string, never>;
	[AdminNotificationJobName.SEND]: AdminNotificationSendData;
}

export type AdminNotificationJobData =
	AdminNotificationJobMap[keyof AdminNotificationJobMap];

// =============================================================================
// Job Options
// =============================================================================

/** 잡 등록 시 공통 옵션 */
export const ADMIN_NOTIFICATION_JOB_OPTS = {
	attempts: 3,
	backoff: { type: "exponential" as const, delay: 5_000 },
	removeOnComplete: true,
	removeOnFail: { count: 100, age: 86_400 },
} as const;

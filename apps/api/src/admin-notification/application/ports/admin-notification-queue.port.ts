import type { AdminNotification } from "../../domain/value-objects/admin-notification-message.vo";

/** 알림 발송 채널 (관리자/결제) */
export type NotificationChannel = "admin" | "payment";

/** enqueueSend 옵션 */
export interface EnqueueSendOptions {
	/** 멱등 잡 ID (중복 등록 방지) */
	jobId?: string;
}

/**
 * 관리자 알림 큐 포트.
 *
 * 조립된 관리자 알림 메시지를 지정 채널로 발송하는 SEND 잡을 큐에 등록한다.
 * 어댑터가 BullMQ 큐로 위임한다.
 */
export interface AdminNotificationQueuePort {
	enqueueSend(
		channel: NotificationChannel,
		notification: AdminNotification,
		options?: EnqueueSendOptions,
	): Promise<void>;
}

export const ADMIN_NOTIFICATION_QUEUE_PORT = Symbol(
	"ADMIN_NOTIFICATION_QUEUE_PORT",
);

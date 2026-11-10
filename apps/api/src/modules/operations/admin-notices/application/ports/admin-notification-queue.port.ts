import type { AdminNotice } from "../read-models/admin-notice.read-model.js";

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
 * 관리자 알림을 지정 채널로 발송하는 SEND 잡을 큐에 등록한다.
 * 어댑터가 작업 큐로 위임한다.
 */
export interface AdminNotificationQueuePort {
  enqueueSend(
    channel: NotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void>;
}

export const ADMIN_NOTIFICATION_QUEUE_PORT = Symbol("ADMIN_NOTIFICATION_QUEUE_PORT");

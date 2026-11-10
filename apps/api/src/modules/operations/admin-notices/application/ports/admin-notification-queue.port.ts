import type { AdminNotice } from "../read-models/admin-notice.read-model.js";

/** 알림 발송 채널 (관리자/결제) */
export type NotificationChannel = "admin" | "payment";

export interface EnqueueSendOptions {
  /** 멱등 잡 ID (중복 등록 방지) */
  readonly jobId?: string;
}

/** 관리자 알림을 지정 채널로 발송하는 SEND 작업을 큐에 등록한다. */
export abstract class AdminNotificationQueuePort {
  abstract enqueueSend(
    channel: NotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void>;
}

import type { AdminNotificationChannel } from "../../domain/admin-notices.constants.js";
import type { AdminNotice } from "../read-models/admin-notice.read-model.js";

export interface EnqueueSendOptions {
  /** 멱등 잡 ID (중복 등록 방지) */
  readonly jobId?: string;
}

/** 관리자 알림을 지정 채널로 발송하는 SEND 작업을 큐에 등록한다. */
export abstract class AdminNotificationQueuePort {
  abstract enqueueSend(
    channel: AdminNotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void>;
}

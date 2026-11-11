import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  AdminNotificationQueuePort,
  type EnqueueSendOptions,
} from "../../application/ports/admin-notification-queue.port.js";
import type { AdminNotice } from "../../application/read-models/admin-notice.read-model.js";
import type { AdminNotificationChannel } from "../../domain/admin-notices.constants.js";
import {
  ADMIN_NOTIFICATION_QUEUE,
  AdminNotificationJobName,
} from "../jobs/admin-notification.queue.js";

// 관리자 알림을 SEND 작업으로 등록한다. 채널 표시는 발송할 때 어댑터가 그린다
@Injectable()
export class AdminNotificationQueueAdapter extends AdminNotificationQueuePort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async enqueueSend(
    channel: AdminNotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void> {
    await this.#jobQueue.enqueue(
      ADMIN_NOTIFICATION_QUEUE,
      { name: AdminNotificationJobName.SEND, data: { channel, notice } },
      options?.jobId == null ? undefined : { idempotencyKey: options.jobId },
    );
  }
}

import { Inject, Injectable } from "@nestjs/common";

import {
  type EnqueueJobOptions,
  JOB_RUNTIME,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import type {
  AdminNotificationQueuePort,
  EnqueueSendOptions,
  NotificationChannel,
} from "../../application/ports/admin-notification-queue.port.js";
import type { AdminNotice } from "../../application/read-models/admin-notice.read-model.js";
import {
  ADMIN_NOTIFICATION_JOB_POLICY,
  ADMIN_NOTIFICATION_QUEUE,
  AdminNotificationJobName,
  type AdminNotificationSendData,
} from "../jobs/admin-notification.queue.js";

/**
 * JobRuntime 관리자 알림 큐 어댑터.
 *
 * 관리자 알림을 SEND 잡으로 등록한다. 채널 표시는 발송할 때 어댑터가 그린다.
 */
@Injectable()
export class AdminNotificationQueueAdapter implements AdminNotificationQueuePort {
  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  async enqueueSend(
    channel: NotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void> {
    const jobOptions: EnqueueJobOptions =
      options?.jobId == null
        ? ADMIN_NOTIFICATION_JOB_POLICY
        : { ...ADMIN_NOTIFICATION_JOB_POLICY, idempotencyKey: options.jobId };
    await this.#runtime.enqueue(
      ADMIN_NOTIFICATION_QUEUE,
      {
        name: AdminNotificationJobName.SEND,
        data: { channel, notice } satisfies AdminNotificationSendData,
      },
      jobOptions,
    );
  }
}

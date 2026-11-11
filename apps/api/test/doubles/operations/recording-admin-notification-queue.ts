import {
  AdminNotificationQueuePort,
  type EnqueueSendOptions,
} from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";
import type { AdminNotificationChannel } from "#api/modules/operations/admin-notices/domain/admin-notices.constants";

export interface RecordedAdminNotice {
  readonly channel: AdminNotificationChannel;
  readonly notice: AdminNotice;
  readonly options?: EnqueueSendOptions;
}

export class RecordingAdminNotificationQueue extends AdminNotificationQueuePort {
  readonly sent: RecordedAdminNotice[] = [];
  failure: Error | null = null;

  async enqueueSend(
    channel: AdminNotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.sent.push({ channel, notice, ...(options != null && { options }) });
  }
}

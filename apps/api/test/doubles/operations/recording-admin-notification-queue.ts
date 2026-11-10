import {
  AdminNotificationQueuePort,
  type EnqueueSendOptions,
  type NotificationChannel,
} from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";

export interface RecordedAdminNotice {
  readonly channel: NotificationChannel;
  readonly notice: AdminNotice;
  readonly options?: EnqueueSendOptions;
}

export class RecordingAdminNotificationQueue extends AdminNotificationQueuePort {
  readonly sent: RecordedAdminNotice[] = [];
  failure: Error | null = null;

  async enqueueSend(
    channel: NotificationChannel,
    notice: AdminNotice,
    options?: EnqueueSendOptions,
  ): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.sent.push({ channel, notice, ...(options != null && { options }) });
  }
}

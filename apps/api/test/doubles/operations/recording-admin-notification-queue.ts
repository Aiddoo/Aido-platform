import { AdminNotificationQueuePort } from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import type {
  AdminNotice,
  AdminNoticePrimitives,
} from "#api/modules/operations/admin-notices/domain/admin-notice.aggregate";
import type { AdminNotificationChannel } from "#api/modules/operations/admin-notices/domain/admin-notices.constants";

export interface RecordedAdminNotice {
  readonly channel: AdminNotificationChannel;
  readonly notice: AdminNoticePrimitives;
  readonly deduplicationKey: string | null;
}

// 큐에 올리지 않고 등록한 알림을 작업 payload와 같은 값으로 기록한다
export class RecordingAdminNotificationQueue extends AdminNotificationQueuePort {
  readonly sent: RecordedAdminNotice[] = [];
  failure: Error | null = null;

  async enqueueSend(notice: AdminNotice): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.sent.push({
      channel: notice.channel,
      notice: notice.toPrimitives(),
      deduplicationKey: notice.deduplicationKey,
    });
  }
}

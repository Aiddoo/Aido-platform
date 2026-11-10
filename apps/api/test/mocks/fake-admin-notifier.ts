import type { NotificationChannel } from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import type {
  AdminNotifierPort,
  AdminNotifyOutcome,
} from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";

export interface SentAdminNotification {
  readonly channel: NotificationChannel;
  readonly notice: AdminNotice;
}

/**
 * 테스트용 FakeAdminNotifier
 *
 * 실제 알림 채널을 호출하지 않고, 발송된 알림을 채널과 함께 메모리에 저장합니다.
 */
export class FakeAdminNotifier implements AdminNotifierPort {
  #sent: SentAdminNotification[] = [];

  async send(channel: NotificationChannel, notice: AdminNotice): Promise<AdminNotifyOutcome> {
    this.#sent.push({ channel, notice });
    return { status: "sent" };
  }

  getSent(channel?: NotificationChannel): SentAdminNotification[] {
    return this.#sent.filter((sent) => channel == null || sent.channel === channel);
  }

  getSentCount(): number {
    return this.#sent.length;
  }

  clear(): void {
    this.#sent = [];
  }
}

import type { NotificationChannel } from "#api/modules/operations/application/ports/notifications/admin-notification-queue.port";
import type {
  AdminNotifierPort,
  AdminNotifyOutcome,
} from "#api/modules/operations/application/ports/notifications/admin-notifier.port";
import type { AdminNotification } from "#api/modules/operations/application/read-models/notifications/admin-notification.read-model";

export interface SentAdminNotification {
  readonly channel: NotificationChannel;
  readonly notification: AdminNotification;
}

/**
 * 테스트용 FakeAdminNotifier
 *
 * 실제 알림 채널을 호출하지 않고, 발송된 알림을 채널과 함께 메모리에 저장합니다.
 */
export class FakeAdminNotifier implements AdminNotifierPort {
  #sent: SentAdminNotification[] = [];

  async send(
    channel: NotificationChannel,
    notification: AdminNotification,
  ): Promise<AdminNotifyOutcome> {
    this.#sent.push({ channel, notification });
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

import type { NotificationId } from "#api/modules/notification/notifications/domain/notification-id.vo";
import { SnoozeNotificationReaderPort } from "#api/modules/notification/reminders/application/ports/snooze-notification.reader.port";
import type { SnoozeNotificationReadModel } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

// 넣어 둔 알림만 있는 알림으로 답한다
export class StubSnoozeNotificationReader extends SnoozeNotificationReaderPort {
  readonly notifications = new Map<number, SnoozeNotificationReadModel>();

  async findNotification(
    notificationId: NotificationId,
  ): Promise<SnoozeNotificationReadModel | null> {
    return this.notifications.get(notificationId.value) ?? null;
  }
}

import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import type { SnoozeNotificationReadModel } from "../read-models/scheduler.read-model.js";

/** 다시 알림 버튼을 누른 알림을 읽는 포트. 알림 행은 notifications slice가 소유한다 */
export abstract class SnoozeNotificationReaderPort {
  abstract findNotification(
    notificationId: NotificationId,
  ): Promise<SnoozeNotificationReadModel | null>;
}

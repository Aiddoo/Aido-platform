import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../../notifications/domain/notification-id.vo.js";
import { NotificationInboxReaderPort } from "../../../notifications/notification-notifications.public.js";
import type { SnoozeNotificationReaderPort } from "../../application/ports/snooze-notification.reader.port.js";
import type { SnoozeNotificationReadModel } from "../../application/read-models/scheduler.read-model.js";

// metadata는 알림 종류마다 모양이 달라 리마인드 단계만 꺼낸다
const reminderMetadataSchema = z.object({ stage: z.string() });

/** 다시 알림 버튼을 누른 알림을 notifications slice의 알림함 조회 포트로 읽는다. */
@Injectable()
export class InboxSnoozeNotificationAdapter implements SnoozeNotificationReaderPort {
  readonly #notificationInboxReader: Pick<NotificationInboxReaderPort, "findInboxNotification">;

  constructor(notificationInboxReader: NotificationInboxReaderPort) {
    this.#notificationInboxReader = notificationInboxReader;
  }

  async findNotification(
    notificationId: NotificationId,
  ): Promise<SnoozeNotificationReadModel | null> {
    const notification = await this.#notificationInboxReader.findInboxNotification(notificationId);
    if (notification == null) {
      return null;
    }
    const metadata = reminderMetadataSchema.safeParse(notification.metadata);
    return {
      recipientId: UserId.reconstitute(notification.userId),
      type: notification.type,
      todoId: notification.todoId,
      stage: metadata.success ? metadata.data.stage : null,
      createdAt: notification.createdAt,
    };
  }
}

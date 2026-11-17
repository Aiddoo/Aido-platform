import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notifications/notification-notifications-jobs.public";

import type {
  ReminderNudgeNotifierPort,
  ReminderNudgeSentNotification,
} from "../../application/ports/reminder-nudge-notifier.port.js";

@Injectable()
export class ReminderNudgeNotifierAdapter implements ReminderNudgeNotifierPort {
  readonly #notificationQueue: NotificationQueueAdapter;

  constructor(notificationQueue: NotificationQueueAdapter) {
    this.#notificationQueue = notificationQueue;
  }

  notifyNudgeSent(notification: ReminderNudgeSentNotification): Promise<void> {
    return this.#notificationQueue.enqueueNudgeSent({
      nudgeId: notification.nudgeId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
      senderName: notification.senderName,
      message: notification.message,
    });
  }
}

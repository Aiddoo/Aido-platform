import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";

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
    return this.#notificationQueue.enqueueNudgeSent(notification);
  }
}

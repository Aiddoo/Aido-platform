import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notifications/notification-notifications-jobs.public";

import {
  CheerNotifierPort,
  type CheerSentNotification,
} from "../../application/ports/cheer-notifier.port.js";

@Injectable()
export class CheerNotifierAdapter extends CheerNotifierPort {
  readonly #queue: NotificationQueueAdapter;

  constructor(queue: NotificationQueueAdapter) {
    super();
    this.#queue = queue;
  }

  notifyCheerSent(notification: CheerSentNotification): Promise<void> {
    return this.#queue.enqueueCheerSent({
      cheerId: notification.cheerId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
      senderName: notification.senderName,
      message: notification.message,
    });
  }
}

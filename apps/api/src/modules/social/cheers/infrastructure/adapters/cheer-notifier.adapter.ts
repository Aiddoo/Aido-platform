import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";

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
    return this.#queue.enqueueCheerSent(notification);
  }
}

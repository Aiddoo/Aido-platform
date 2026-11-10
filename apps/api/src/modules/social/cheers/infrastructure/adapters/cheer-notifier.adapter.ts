import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";

import {
  CheerNotifierPort,
  type CheerSentNotification,
} from "../../application/ports/cheer-notifier.port.js";

@Injectable()
export class CheerNotifierAdapter extends CheerNotifierPort {
  readonly #queue: NotificationQueueService;

  constructor(queue: NotificationQueueService) {
    super();
    this.#queue = queue;
  }

  notifyCheerSent(notification: CheerSentNotification): void {
    this.#queue.enqueueCheerSent(notification);
  }
}

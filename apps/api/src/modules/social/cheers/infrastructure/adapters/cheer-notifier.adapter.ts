import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  CheerNotifierPort,
  CheerSentNotification,
} from "../../application/ports/cheer-notifier.port.js";

/**
 * CheerNotifierPort의 어댑터 — NotificationQueueService에 위임한다.
 */
@Injectable()
export class CheerNotifierAdapter implements CheerNotifierPort {
  readonly #queue: NotificationQueueService;

  constructor(queue: NotificationQueueService) {
    this.#queue = queue;
  }

  notifyCheerSent(payload: CheerSentNotification): void {
    this.#queue.enqueueCheerSent(payload);
  }
}

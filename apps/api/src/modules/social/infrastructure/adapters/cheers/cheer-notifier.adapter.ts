import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  CheerNotifierPort,
  CheerSentNotification,
} from "../../../application/ports/cheers/cheer-notifier.port.js";

/**
 * CheerNotifierPort의 어댑터 — 레거시 NotificationQueueService(BullMQ)에 위임한다.
 */
@Injectable()
export class CheerNotifierAdapter implements CheerNotifierPort {
  constructor(private readonly queue: NotificationQueueService) {}

  notifyCheerSent(payload: CheerSentNotification): void {
    this.queue.enqueueCheerSent(payload);
  }
}

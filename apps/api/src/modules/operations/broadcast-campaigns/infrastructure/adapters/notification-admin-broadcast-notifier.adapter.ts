import { Injectable } from "@nestjs/common";

import { PublishNotificationBatchUseCase } from "#api/modules/notification/notifications/notification-notifications.public";

import { AdminBroadcastNotifierPort } from "../../application/ports/admin-broadcast-notifier.port.js";
import type { BroadcastMessageReadModel } from "../../application/read-models/broadcast-message.read-model.js";

@Injectable()
export class NotificationAdminBroadcastNotifierAdapter extends AdminBroadcastNotifierPort {
  readonly #publisher: PublishNotificationBatchUseCase;

  constructor(publisher: PublishNotificationBatchUseCase) {
    super();
    this.#publisher = publisher;
  }

  sendBatch(messages: readonly BroadcastMessageReadModel[]): Promise<{ count: number }> {
    return this.#publisher.execute(
      messages.map((message) => ({
        userId: message.userId,
        type: message.type,
        title: message.title,
        body: message.body,
        action: message.action,
        metadata: message.metadata,
        force: message.force,
        campaignKey: message.campaignKey,
      })),
    );
  }
}

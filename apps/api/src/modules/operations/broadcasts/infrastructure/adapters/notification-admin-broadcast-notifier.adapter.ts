import { Injectable } from "@nestjs/common";

import { PublishNotificationUseCase } from "#api/modules/notification/notification-delivery.public";

import { AdminBroadcastNotifierPort } from "../../application/ports/admin-broadcast-notifier.port.js";
import type { AdminBroadcastMessage } from "../../application/read-models/broadcast-message.read-model.js";

@Injectable()
export class NotificationAdminBroadcastNotifierAdapter extends AdminBroadcastNotifierPort {
  readonly #publisher: PublishNotificationUseCase;

  constructor(publisher: PublishNotificationUseCase) {
    super();
    this.#publisher = publisher;
  }

  sendBatch(messages: readonly AdminBroadcastMessage[]): Promise<{ count: number }> {
    return this.#publisher.publishBatch(
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

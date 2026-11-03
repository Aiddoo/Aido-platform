import { Injectable } from "@nestjs/common";

import { NotificationPublisher } from "#api/modules/notification/notification-delivery.public";

import type { AdminBroadcastNotifierPort } from "../../../application/ports/admin/admin-broadcast-notifier.port.js";
import type { AdminBroadcastMessage } from "../../../application/read-models/admin/broadcast-message.read-model.js";

@Injectable()
export class NotificationAdminBroadcastNotifierAdapter implements AdminBroadcastNotifierPort {
  constructor(private readonly notificationService: NotificationPublisher) {}

  sendBatch(messages: AdminBroadcastMessage[]): Promise<{ count: number }> {
    return this.notificationService.publishBatch(
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

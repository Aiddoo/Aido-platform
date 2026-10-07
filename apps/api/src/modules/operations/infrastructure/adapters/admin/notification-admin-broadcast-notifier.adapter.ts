import { Injectable } from "@nestjs/common";

import { NotificationPublisher } from "#api/modules/notification/notification-delivery.public";

import type { AdminBroadcastNotifierPort } from "../../../application/ports/admin/admin-broadcast-notifier.port.js";
import type { AdminBroadcastMessage } from "../../../application/read-models/admin/broadcast-message.read-model.js";

/**
 * AdminBroadcastNotifierPort의 NotificationPublisher 어댑터.
 *
 * 벤더 중립 브로드캐스트 메시지를 알림 모듈의 배치 생성·발송으로 위임한다.
 * 다른 발송 채널로 바꾸려면 이 어댑터만 교체하면 된다.
 */
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
      })),
    );
  }
}

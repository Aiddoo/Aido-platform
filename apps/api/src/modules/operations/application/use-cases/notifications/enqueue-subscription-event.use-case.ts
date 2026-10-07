import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";

import { buildSubscriptionEventMessage } from "../../messages/notifications/admin-message.factory.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";

/**
 * 구독 이벤트 관리자 알림 등록 유스케이스.
 *
 * RevenueCat 구독 이벤트를 결제 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 */
interface EnqueueSubscriptionEventDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
}

export class EnqueueSubscriptionEvent {
  readonly #dependencies: EnqueueSubscriptionEventDependencies;

  constructor(dependencies: EnqueueSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: SubscriptionEventPayload): Promise<void> {
    const message = buildSubscriptionEventMessage(payload);
    await this.#dependencies.queue.enqueueSend("payment", message);
  }
}

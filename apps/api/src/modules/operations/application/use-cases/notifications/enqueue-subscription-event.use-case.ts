import { buildSubscriptionEventMessage } from "../../messages/notifications/admin-message.factory.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";

/**
 * 구독 이벤트 관리자 알림 등록 유스케이스.
 *
 * RevenueCat 구독 이벤트를 결제 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 * 이벤트 ID가 있으면 같은 이벤트의 알림 잡을 한 번만 등록한다.
 */
interface EnqueueSubscriptionEventDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
}

export class EnqueueSubscriptionEvent {
  readonly #dependencies: EnqueueSubscriptionEventDependencies;

  constructor(dependencies: EnqueueSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: SubscriptionAlertInput): Promise<void> {
    const message = buildSubscriptionEventMessage(payload);
    await this.#dependencies.queue.enqueueSend(
      "payment",
      message,
      payload.eventId ? { jobId: `subscription-event_${payload.eventId}` } : undefined,
    );
  }
}

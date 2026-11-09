import {
  buildSubscriptionNotice,
  subscriptionNoticeUserOf,
} from "../../messages/notifications/admin-notice.factory.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import type { AdminNoticeUserResolver } from "../../services/notifications/admin-notice-user.resolver.js";
import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";

/**
 * 구독 이벤트 관리자 알림 등록 유스케이스.
 *
 * billing이 구독 반영을 커밋한 뒤 넘긴 이벤트에 사용자 블록을 붙여 결제 채널 SEND 잡으로 등록한다.
 * 이벤트 ID가 있으면 같은 이벤트의 알림 잡을 한 번만 등록한다.
 */
interface EnqueueSubscriptionEventDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly users: Pick<AdminNoticeUserResolver, "resolve">;
}

export class EnqueueSubscriptionEvent {
  readonly #dependencies: EnqueueSubscriptionEventDependencies;

  constructor(dependencies: EnqueueSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: SubscriptionAlertInput): Promise<void> {
    const user = await this.#dependencies.users.resolve(subscriptionNoticeUserOf(payload));
    await this.#dependencies.queue.enqueueSend(
      "payment",
      buildSubscriptionNotice(payload, user),
      payload.eventId ? { jobId: `subscription-event_${payload.eventId}` } : undefined,
    );
  }
}

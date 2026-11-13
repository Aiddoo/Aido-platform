import {
  buildSubscriptionNotice,
  subscriptionNoticeUserOf,
} from "../messages/admin-notice.messages.js";
import type { SubscriptionAlertInput } from "../ports/admin-event-notifier.port.js";
import type { AdminNotificationQueuePort } from "../ports/admin-notification-queue.port.js";
import type { ResolveAdminNoticeUserUseCase } from "./resolve-admin-notice-user.use-case.js";

export interface EnqueueSubscriptionEventDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly resolveUser: Pick<ResolveAdminNoticeUserUseCase, "execute">;
}

/**
 * billing이 구독 반영을 커밋한 뒤 넘긴 이벤트에 사용자 블록을 붙여 결제 채널 SEND 작업으로 등록한다.
 * 이벤트 ID가 있으면 같은 이벤트의 알림 작업을 한 번만 등록한다.
 */
export class EnqueueSubscriptionEventUseCase {
  readonly #dependencies: EnqueueSubscriptionEventDependencies;

  constructor(dependencies: EnqueueSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: SubscriptionAlertInput): Promise<void> {
    const { queue, resolveUser } = this.#dependencies;
    const user = await resolveUser.execute(subscriptionNoticeUserOf(payload));
    await queue.enqueueSend(
      "payment",
      buildSubscriptionNotice(payload, user),
      payload.eventId ? { jobId: `subscription-event_${payload.eventId}` } : undefined,
    );
  }
}

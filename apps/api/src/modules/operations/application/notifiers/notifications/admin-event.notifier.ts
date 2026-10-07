import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { OperationsNotificationsLogEvent } from "../../observability/notifications/operations-notifications-log.events.js";
import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";
import type { EnqueueSubscriptionEvent } from "../../use-cases/notifications/enqueue-subscription-event.use-case.js";
import type { EnqueueUserRegistered } from "../../use-cases/notifications/enqueue-user-registered.use-case.js";

/** 운영 흐름과 격리된 관리자 이벤트 알림 큐 진입점. */
interface AdminEventNotifierDependencies {
  readonly enqueueUserRegistered: Pick<EnqueueUserRegistered, "execute">;
  readonly enqueueSubscriptionEvent: Pick<EnqueueSubscriptionEvent, "execute">;
  readonly logger: Pick<ApplicationLogger, "error">;
}

export class AdminEventNotifier {
  readonly #dependencies: AdminEventNotifierDependencies;

  constructor(dependencies: AdminEventNotifierDependencies) {
    this.#dependencies = dependencies;
  }

  notifyUserRegistered(payload: UserRegisteredEventPayload): void {
    this.#dependencies.enqueueUserRegistered.execute(payload).catch(() => {
      this.#dependencies.logger.error({
        event: OperationsNotificationsLogEvent.SIGNUP_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.#dependencies.enqueueSubscriptionEvent.execute(payload).catch(() => {
      this.#dependencies.logger.error({
        event: OperationsNotificationsLogEvent.SUBSCRIPTION_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }
}
